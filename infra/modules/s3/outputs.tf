output "raw_bucket" {
  description = "Name of the raw videos S3 bucket"
  value       = aws_s3_bucket.raw_videos.bucket
}

output "processed_bucket" {
  description = "Name of the processed videos S3 bucket"
  value       = aws_s3_bucket.processed_videos.bucket
}