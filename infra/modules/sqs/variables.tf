variable "project" {
  type = string
  description = "Project name used for resource naming"
}

variable "raw_bucket_id" {
  type = string
  description = "ID of the raw videos S3 bucket"
}

variable "sqs_arn" {
  type = string
  description = "ARN of the SQS queue"
}