resource "aws_sqs_queue" "dlq" {
  name = "${var.project}-dlq"
}

resource "aws_sqs_queue" "main" {
  name = "${var.project}-queue"

  visibility_timeout_seconds = 300   
  message_retention_seconds  = 86400 
  receive_wait_time_seconds  = 10    


  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.dlq.arn
    maxReceiveCount     = 3
  })
}



output "queue_url" {
  description = "URL of the SQS queue"
  value       = aws_sqs_queue.main.url
}

resource "aws_sqs_queue_policy" "allow_s3" {
  queue_url = aws_sqs_queue.main.id

  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Effect = "Allow",
        Principal = {
          Service = "s3.amazonaws.com"
        },
        Action = "SQS:SendMessage",
        Resource = aws_sqs_queue.main.arn,
        Condition = {
          ArnEquals = {
            "aws:SourceArn" = aws_s3_bucket.raw_videos.arn
          }
        }
      }
    ]
  })
}