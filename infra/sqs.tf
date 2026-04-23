resource "aws_sqs_queue" "dlq" {
  name = "${var.project}-dlq"
}

resource "aws_sqs_queue" "main" {
  name = "${var.project}-queue"

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.dlq.arn
    maxReceiveCount     = 3
  })
}

resource "aws_s3_bucket_notification" "notify" {
  bucket = aws_s3_bucket.raw_videos.bucket

  queue {
    queue_arn = aws_sqs_queue.main.arn
    events    = ["s3:ObjectCreated:*"]
  }
}

output "queue_url" {
  description = "URL of the SQS queue"
  value       = aws_sqs_queue.main.url
}