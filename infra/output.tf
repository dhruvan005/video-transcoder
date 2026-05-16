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
