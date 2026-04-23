variable "aws_region" {
  type = string
  default = "ap-south-1"
}

variable "project" {
  type = string
  default = "video-transcoder"
}

variable "raw_bucket_id" {
  type = string
  description = "ID of the raw videos S3 bucket"
}

variable "sqs_arn" {
  type = string
  description = "ARN of the SQS queue"
}

variable "sqs_url" {
  type = string
  description = "URL of the SQS queue"
}

variable "raw_bucket" {
  type = string
  description = "Name of the raw videos S3 bucket"
}

variable "processed_bucket" {
  type = string
  description = "Name of the processed videos S3 bucket"
}

# variable "ecr_image" {
#   type = string
#   description = "URI of the ECR image for the ECS task"
# }
# variable "execution_role_arn" {
#   type = string
#   description = "ARN of the IAM role for ECS task execution"
# }

# variable "task_role_arn" {
#   type = string
#   description = "ARN of the IAM role for ECS task permissions"
# }

# variable "private_subnets" {
#   type = list(string)
#   description = "Private Subnets"
# }