data "aws_vpc" "default" {
  default = true
}

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}

resource "aws_cloudwatch_log_group" "transcoder" {
  name              = "/ecs/${var.project}"
  retention_in_days = 7
}

resource "aws_iam_role" "ecs_execution_role" {
  name = "${var.project}-ecs-execution-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [{
      Action    = "sts:AssumeRole",
      Effect    = "Allow",
      Principal = { Service = "ecs-tasks.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_execution_policy" {
  role       = aws_iam_role.ecs_execution_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role" "ecs_task_role" {
  name = "${var.project}-ecs-task-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [{
      Action    = "sts:AssumeRole",
      Effect    = "Allow",
      Principal = { Service = "ecs-tasks.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy" "ecs_task_s3_policy" {
  name = "${var.project}-s3-access"
  role = aws_iam_role.ecs_task_role.id

  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["s3:GetObject"]
        Resource = "${aws_s3_bucket.raw_videos.arn}/*"
      },
      {
        Effect   = "Allow"
        Action   = ["s3:PutObject"]
        Resource = "${aws_s3_bucket.processed_videos.arn}/*"
      }
    ]
  })
}

resource "aws_security_group" "ecs_tasks" {
  name        = "${var.project}-ecs-tasks"
  description = "Outbound-only for Fargate transcoder tasks"
  vpc_id      = data.aws_vpc.default.id

  egress {
    description = "HTTPS to AWS services (S3, ECR, CloudWatch)"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description = "Redis (ElastiCache) for job status"
    from_port   = 6379
    to_port     = 6379
    protocol    = "tcp"
    cidr_blocks = [data.aws_vpc.default.cidr_block]
  }
}

resource "aws_ecs_cluster" "main" {
  name = "${var.project}-cluster"
}

resource "aws_ecs_task_definition" "transcoder" {
  family                   = "${var.project}-transcoder"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = "2048" # 2 vCPU — single-decode ffmpeg pass uses all cores
  memory                   = "4096"

  execution_role_arn = aws_iam_role.ecs_execution_role.arn
  task_role_arn      = aws_iam_role.ecs_task_role.arn

  container_definitions = jsonencode([
    {
      name      = "transcoder"
      image     = "${aws_ecr_repository.video_transcoder.repository_url}:latest"
      essential = true

      environment = [
        { name = "AWS_REGION", value = var.aws_region },
        { name = "BUCKET_NAME_RAW", value = local.raw_bucket_name },
        { name = "BUCKET_NAME_TRANSCODED", value = local.processed_bucket_name },
        { name = "REDIS_URI", value = local.redis_uri }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.transcoder.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "transcoder"
        }
      }
    }
  ])
}

// Note: The task role is defined here to give ECS tasks permissions to access S3 buckets.
# resource "aws_iam_role" "backend_task_role" {
#   name = "${var.project}-backend-task-role"
#   assume_role_policy = data.aws_iam_policy_document.ecs_assume_role.json
# }

# resource "aws_iam_role_policy_attachment" "backend_policy" {
#   role       = aws_iam_role.backend_task_role.name
#   policy_arn = aws_iam_policy.backend_policy.arn  # already exists in backend_iam.tf
# }
