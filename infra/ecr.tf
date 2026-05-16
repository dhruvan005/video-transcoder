resource "aws_ecr_repository" "video_transcoder" {
  name                 = var.ecr_repository_name
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }
}

# Policy granting push rights
resource "aws_iam_policy" "ecr_push_policy" {
  name        = "${var.project}-ecr-push"
  description = "Allows docker build/push to ECR"

  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Effect = "Allow"
        Action = ["ecr:GetAuthorizationToken"]
        # GetAuthorizationToken is account-level, not repo-level
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "ecr:BatchCheckLayerAvailability",
          "ecr:InitiateLayerUpload",
          "ecr:UploadLayerPart",
          "ecr:CompleteLayerUpload",
          "ecr:PutImage"
        ]
        Resource = aws_ecr_repository.video_transcoder.arn
      }
    ]
  })
}

output "ecr_push_policy_arn" {
  description = "Attach this to the IAM user/role used for docker push (CI or local dev)"
  value       = aws_iam_policy.ecr_push_policy.arn
}