resource "aws_s3_bucket" "raw_videos" {
  bucket = local.raw_bucket_name
}

resource "aws_s3_bucket" "processed_videos" {
  bucket = local.processed_bucket_name
}

# Block public access
resource "aws_s3_bucket_public_access_block" "block" {
  bucket = aws_s3_bucket.raw_videos.id

  block_public_acls   = true
  block_public_policy = true
}

output "raw_bucket" {
  description = "Name of the raw videos S3 bucket"
  value       = aws_s3_bucket.raw_videos.bucket
}

output "processed_bucket" {
  description = "Name of the processed videos S3 bucket"
  value       = aws_s3_bucket.processed_videos.bucket
}




resource "aws_s3_bucket_notification" "notify_lambda" {
  bucket = aws_s3_bucket.raw_videos.id

  lambda_function {
    lambda_function_arn = aws_lambda_function.source_bucket_trigger.arn
    events              = ["s3:ObjectCreated:*"]
  }

  depends_on = [aws_lambda_permission.allow_s3]
}

# Browsers upload directly to this bucket via a presigned POST, so it needs a
# CORS policy that permits cross-origin POSTs from the frontend.
resource "aws_s3_bucket_cors_configuration" "raw_uploads" {
  bucket = aws_s3_bucket.raw_videos.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["POST"]
    allowed_origins = ["*"]
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
}

resource "aws_s3_bucket_versioning" "versioning" {
  bucket = aws_s3_bucket.raw_videos.id

  versioning_configuration {
    status = "Enabled"
  }
}

# Allow the frontend to upload directly to the raw bucket with presigned PUT URLs.
# Without this, browser uploads fail the CORS preflight.
resource "aws_s3_bucket_cors_configuration" "raw_cors" {
  bucket = aws_s3_bucket.raw_videos.id

  cors_rule {
    allowed_methods = ["PUT"]
    allowed_origins = var.frontend_origins
    allowed_headers = ["*"]
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "enc" {
  bucket = aws_s3_bucket.raw_videos.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}