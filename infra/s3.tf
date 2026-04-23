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