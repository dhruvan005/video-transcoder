resource "aws_s3_bucket" "raw_videos" {
  bucket = "${var.project}-raw-videos"
}

resource "aws_s3_bucket" "processed_videos" {
  bucket = "${var.project}-processed-videos"
}

# Block public access
resource "aws_s3_bucket_public_access_block" "block" {
  bucket = aws_s3_bucket.raw_videos.id

  block_public_acls   = true
  block_public_policy = true
}