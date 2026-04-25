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




resource "aws_s3_bucket_notification" "notify_sqs" {
  bucket = aws_s3_bucket.raw_videos.id

  queue {
    queue_arn = aws_sqs_queue.main.arn
    events    = ["s3:ObjectCreated:*"]
  }

  depends_on = [aws_sqs_queue_policy.allow_s3]
}

resource "aws_s3_bucket_versioning" "versioning" {
  bucket = aws_s3_bucket.raw_videos.id

  versioning_configuration {
    status = "Enabled"
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