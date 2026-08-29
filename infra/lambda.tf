locals {
  lambda_src_dir = "${path.module}/../lambda/functions"
}

# Build & bundle the TypeScript handlers into dist/<name>/index.js. Re-runs
# whenever the sources or dependency manifest change.
resource "null_resource" "lambda_build" {
  triggers = {
    package_lock = filesha1("${local.lambda_src_dir}/package-lock.json")
    src_hash = sha1(join("", [
      for f in fileset("${local.lambda_src_dir}/src", "**/*.ts") :
      filesha1("${local.lambda_src_dir}/src/${f}")
    ]))
  }

  provisioner "local-exec" {
    command     = "npm ci && npm run build"
    working_dir = local.lambda_src_dir
  }
}

data "archive_file" "presigned" {
  type        = "zip"
  source_dir  = "${local.lambda_src_dir}/dist/presigned-post"
  output_path = "${local.lambda_src_dir}/dist/presigned-post.zip"
  depends_on  = [null_resource.lambda_build]
}

data "archive_file" "trigger" {
  type        = "zip"
  source_dir  = "${local.lambda_src_dir}/dist/source-bucket-trigger"
  output_path = "${local.lambda_src_dir}/dist/source-bucket-trigger.zip"
  depends_on  = [null_resource.lambda_build]
}

data "archive_file" "status" {
  type        = "zip"
  source_dir  = "${local.lambda_src_dir}/dist/status"
  output_path = "${local.lambda_src_dir}/dist/status.zip"
  depends_on  = [null_resource.lambda_build]
}

# ── Presigned upload URL (GET /signedurl) ───────────────────────────────────
resource "aws_lambda_function" "presigned_post" {
  function_name    = "${var.project}-presigned-post"
  filename         = data.archive_file.presigned.output_path
  source_code_hash = data.archive_file.presigned.output_base64sha256
  handler          = "index.handler"
  runtime          = "nodejs20.x"
  timeout          = 10
  role             = aws_iam_role.presigned_lambda.arn

  environment {
    variables = {
      BUCKET_NAME_RAW = local.raw_bucket_name
    }
  }
}

# ── S3 → ECS RunTask trigger ─────────────────────────────────────────────────
resource "aws_lambda_function" "source_bucket_trigger" {
  function_name    = "${var.project}-source-bucket-trigger"
  filename         = data.archive_file.trigger.output_path
  source_code_hash = data.archive_file.trigger.output_base64sha256
  handler          = "index.handler"
  runtime          = "nodejs20.x"
  timeout          = 30
  role             = aws_iam_role.trigger_lambda.arn

  environment {
    variables = {
      ECS_CLUSTER_ARN         = aws_ecs_cluster.main.arn
      ECS_TASK_DEFINITION_ARN = aws_ecs_task_definition.transcoder.family
      ECS_SUBNETS             = join(",", data.aws_subnets.default.ids)
      ECS_SECURITY_GROUP_ID   = aws_security_group.ecs_tasks.id
    }
  }
}

# ── Job status lookup (GET /status/{key}) ────────────────────────────────────
resource "aws_lambda_function" "status" {
  function_name    = "${var.project}-status"
  filename         = data.archive_file.status.output_path
  source_code_hash = data.archive_file.status.output_base64sha256
  handler          = "index.handler"
  runtime          = "nodejs20.x"
  timeout          = 10
  role             = aws_iam_role.status_lambda.arn

  # Attached to the VPC so it can reach ElastiCache.
  vpc_config {
    subnet_ids         = data.aws_subnets.default.ids
    security_group_ids = [aws_security_group.status_lambda.id]
  }

  environment {
    variables = {
      REDIS_URI = local.redis_uri
    }
  }
}

# Security group for the VPC-attached status Lambda — egress-only so it can
# reach Redis (and the ENI can talk out); ingress isn't needed.
resource "aws_security_group" "status_lambda" {
  name        = "${var.project}-status-lambda"
  description = "Status Lambda egress to Redis"
  vpc_id      = data.aws_vpc.default.id

  egress {
    description = "All outbound (reaches Redis on 6379)"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# Allow S3 to invoke the trigger Lambda.
resource "aws_lambda_permission" "allow_s3" {
  statement_id  = "AllowS3Invoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.source_bucket_trigger.function_name
  principal     = "s3.amazonaws.com"
  source_arn    = aws_s3_bucket.raw_videos.arn
}
