data "aws_iam_policy_document" "lambda_assume_role" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

# ── Presigned Lambda: sign uploads to the raw bucket ─────────────────────────
resource "aws_iam_role" "presigned_lambda" {
  name               = "${var.project}-presigned-lambda-role"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume_role.json
}

resource "aws_iam_role_policy_attachment" "presigned_logs" {
  role       = aws_iam_role.presigned_lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "presigned_s3" {
  name = "${var.project}-presigned-s3"
  role = aws_iam_role.presigned_lambda.id

  # The presigned POST is authorized as the signer, so the role itself needs
  # PutObject on the raw bucket.
  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [{
      Effect   = "Allow"
      Action   = ["s3:PutObject"]
      Resource = "${aws_s3_bucket.raw_videos.arn}/*"
    }]
  })
}

# ── Trigger Lambda: launch ECS tasks ─────────────────────────────────────────
resource "aws_iam_role" "trigger_lambda" {
  name               = "${var.project}-trigger-lambda-role"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume_role.json
}

resource "aws_iam_role_policy_attachment" "trigger_logs" {
  role       = aws_iam_role.trigger_lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "trigger_ecs" {
  name = "${var.project}-trigger-ecs"
  role = aws_iam_role.trigger_lambda.id

  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["ecs:RunTask"]
        Resource = "arn:aws:ecs:${var.aws_region}:*:task-definition/${aws_ecs_task_definition.transcoder.family}:*"
      },
      {
        Effect = "Allow"
        Action = ["iam:PassRole"]
        Resource = [
          aws_iam_role.ecs_execution_role.arn,
          aws_iam_role.ecs_task_role.arn
        ]
      }
    ]
  })
}

# ── Status Lambda: VPC access to reach Redis ─────────────────────────────────
resource "aws_iam_role" "status_lambda" {
  name               = "${var.project}-status-lambda-role"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume_role.json
}

# AWSLambdaVPCAccessExecutionRole includes CloudWatch Logs + ENI management.
resource "aws_iam_role_policy_attachment" "status_vpc" {
  role       = aws_iam_role.status_lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"
}
