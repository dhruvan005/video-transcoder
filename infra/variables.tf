variable "aws_region" {
  type = string
  default = "ap-south-1"
}

variable "project" {
  type = string
  default = "video-transcoder-dhruvan-patel-dev"
}

variable "ecr_repository_name" {
  type = string
  default = "video-transcoder"
  description = "ECR Repo Name"
}

variable "frontend_origins" {
  type        = list(string)
  description = "Origins allowed to upload directly to the raw bucket via presigned PUT (CORS)."
  default     = ["http://localhost:3000"]
}