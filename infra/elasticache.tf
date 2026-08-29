# Single-node Redis for per-job status tracking. Lives in the default VPC so
# both the Fargate transcoder tasks and the status Lambda can reach it over the
# VPC's private network — no NAT gateway required.

resource "aws_elasticache_subnet_group" "redis" {
  name       = "${var.project}-redis-subnets"
  subnet_ids = data.aws_subnets.default.ids
}

resource "aws_security_group" "redis" {
  name        = "${var.project}-redis"
  description = "Allow Redis access from within the VPC"
  vpc_id      = data.aws_vpc.default.id

  # Reference the VPC CIDR rather than other security groups to avoid a
  # circular dependency between the ECS-task / Lambda SGs and this one.
  ingress {
    description = "Redis from within the VPC"
    from_port   = 6379
    to_port     = 6379
    protocol    = "tcp"
    cidr_blocks = [data.aws_vpc.default.cidr_block]
  }
}

resource "aws_elasticache_cluster" "redis" {
  cluster_id           = "${var.project}-redis"
  engine               = "redis"
  node_type            = "cache.t3.micro"
  num_cache_nodes      = 1
  parameter_group_name = "default.redis7"
  engine_version       = "7.1"
  port                 = 6379

  subnet_group_name  = aws_elasticache_subnet_group.redis.name
  security_group_ids = [aws_security_group.redis.id]
}

locals {
  redis_uri = "redis://${aws_elasticache_cluster.redis.cache_nodes[0].address}:6379"
}
