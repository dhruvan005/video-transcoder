resource "aws_iam_policy" "backend_policy" {
  name        = "${var.project}-backend-policy"
  description = "Allows the backend to launch ECS tasks and poll/delete SQS messages"

  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:GetQueueAttributes"
        ]
        Resource = aws_sqs_queue.main.arn
      },
      {
        Effect = "Allow"
        Action = ["ecs:RunTask"]
        Resource = "arn:aws:ecs:${var.aws_region}:*:task-definition/${aws_ecs_task_definition.transcoder.family}:*"
      },
      {
        Effect   = "Allow"
        Action   = ["iam:PassRole"]
        Resource = [
          aws_iam_role.ecs_execution_role.arn,
          aws_iam_role.ecs_task_role.arn
        ]
      }
    ]
  })
}

output "backend_policy_arn" {
  description = "Attach this policy to the IAM user your backend uses locally"
  value       = aws_iam_policy.backend_policy.arn
}
