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
  bucket = var.raw_bucket_id

  queue {
    queue_arn = var.sqs_arn
    events    = ["s3:ObjectCreated:*"]
  }
}