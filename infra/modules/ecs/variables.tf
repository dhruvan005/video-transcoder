variable "project" {
  type = string
  description = "Project name used for resource naming"
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

variable "ecr_image" {
  type = string
  description = "URI of the ECR image for the ECS task"
  
}
variable "execution_role_arn" {
  type = string
  description = "ARN of the IAM role for ECS task execution"
}

variable "task_role_arn" {
  type = string
  description = "ARN of the IAM role for ECS task permissions"
}

variable "private_subnets" {
  type = list(string)
  description = "Private Subnetes"
}