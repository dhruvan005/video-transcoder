module "s3" {
  source  = "./modules/s3"
  project = var.project
}

module "sqs" {
  source  = "./modules/sqs"
  project = var.project
}

module "ecs" {
  source            = "./modules/ecs"
  project           = var.project
  sqs_url           = module.sqs.queue_url
  raw_bucket        = module.s3.raw_bucket
  processed_bucket  = module.s3.processed_bucket
}