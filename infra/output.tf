output "ecr_repository_url" {
  value = aws_ecr_repository.video_transcoder.repository_url
}

output "ecs_cluster_arn" {
  value = aws_ecs_cluster.main.arn
}

output "ecs_task_definition_arn" {
  value = aws_ecs_task_definition.transcoder.arn
}

output "ecs_task_definition_family" {
  description = "Task definition family — pass this to RunTask (not the full ARN)"
  value       = aws_ecs_task_definition.transcoder.family
}

output "ecs_subnet_ids" {
  value = join(",", data.aws_subnets.default.ids)
}

output "ecs_security_group_id" {
  description = "Security group to pass in networkConfiguration.awsvpcConfiguration when calling RunTask"
  value       = aws_security_group.ecs_tasks.id
}

output "api_gateway_invoke_url" {
  description = "Base invoke URL for the frontend (NEXT_PUBLIC_API_URL). Append /signedurl or /status/{key}."
  value       = aws_api_gateway_stage.prod.invoke_url
}

output "redis_endpoint" {
  description = "ElastiCache Redis endpoint (host:port) — used as REDIS_URI by the worker and status Lambda"
  value       = "${aws_elasticache_cluster.redis.cache_nodes[0].address}:6379"
}
