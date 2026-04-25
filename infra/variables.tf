variable "aws_region" {
  type = string
  default = "ap-south-1"
}

variable "project" {
  type = string
  default = "video-transcoder-dhruvan-patel-dev"
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