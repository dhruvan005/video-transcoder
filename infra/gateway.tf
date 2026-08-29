resource "aws_api_gateway_rest_api" "api" {
  name        = "${var.project}-api"
  description = "Presigned upload URLs and transcode job status"
}

# ── /signedurl (GET → presigned_post Lambda) ─────────────────────────────────
resource "aws_api_gateway_resource" "signedurl" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  parent_id   = aws_api_gateway_rest_api.api.root_resource_id
  path_part   = "signedurl"
}

resource "aws_api_gateway_method" "signedurl_get" {
  rest_api_id   = aws_api_gateway_rest_api.api.id
  resource_id   = aws_api_gateway_resource.signedurl.id
  http_method   = "GET"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "signedurl_get" {
  rest_api_id             = aws_api_gateway_rest_api.api.id
  resource_id             = aws_api_gateway_resource.signedurl.id
  http_method             = aws_api_gateway_method.signedurl_get.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.presigned_post.invoke_arn
}

# ── /status/{key} (GET → status Lambda) ──────────────────────────────────────
resource "aws_api_gateway_resource" "status" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  parent_id   = aws_api_gateway_rest_api.api.root_resource_id
  path_part   = "status"
}

resource "aws_api_gateway_resource" "status_key" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  parent_id   = aws_api_gateway_resource.status.id
  # Greedy variable so keys containing '/' (e.g. videos/<uuid>.mp4) are captured.
  path_part = "{key+}"
}

resource "aws_api_gateway_method" "status_get" {
  rest_api_id   = aws_api_gateway_rest_api.api.id
  resource_id   = aws_api_gateway_resource.status_key.id
  http_method   = "GET"
  authorization = "NONE"

  request_parameters = {
    "method.request.path.key" = true
  }
}

resource "aws_api_gateway_integration" "status_get" {
  rest_api_id             = aws_api_gateway_rest_api.api.id
  resource_id             = aws_api_gateway_resource.status_key.id
  http_method             = aws_api_gateway_method.status_get.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.status.invoke_arn
}

# ── CORS preflight (OPTIONS) for both resources ──────────────────────────────
module "cors_signedurl" {
  source      = "./modules/cors"
  rest_api_id = aws_api_gateway_rest_api.api.id
  resource_id = aws_api_gateway_resource.signedurl.id
}

module "cors_status" {
  source      = "./modules/cors"
  rest_api_id = aws_api_gateway_rest_api.api.id
  resource_id = aws_api_gateway_resource.status_key.id
}

# ── Lambda invoke permissions for API Gateway ────────────────────────────────
resource "aws_lambda_permission" "apigw_presigned" {
  statement_id  = "AllowAPIGatewayInvokePresigned"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.presigned_post.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.api.execution_arn}/*/*"
}

resource "aws_lambda_permission" "apigw_status" {
  statement_id  = "AllowAPIGatewayInvokeStatus"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.status.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.api.execution_arn}/*/*"
}

# ── Deployment + prod stage ──────────────────────────────────────────────────
resource "aws_api_gateway_deployment" "this" {
  rest_api_id = aws_api_gateway_rest_api.api.id

  # Redeploy whenever the API surface changes.
  triggers = {
    redeployment = sha1(jsonencode([
      aws_api_gateway_resource.signedurl.id,
      aws_api_gateway_method.signedurl_get.id,
      aws_api_gateway_integration.signedurl_get.id,
      aws_api_gateway_resource.status_key.id,
      aws_api_gateway_method.status_get.id,
      aws_api_gateway_integration.status_get.id,
      module.cors_signedurl.integration_id,
      module.cors_status.integration_id,
    ]))
  }

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_api_gateway_stage" "prod" {
  rest_api_id   = aws_api_gateway_rest_api.api.id
  deployment_id = aws_api_gateway_deployment.this.id
  stage_name    = "prod"
}
