# Optional disposable builder, for hosts unable to build the Fargate image locally.
resource "aws_s3_bucket" "build" {
  count         = var.remote_build_enabled ? 1 : 0
  bucket        = "${var.name}-build-${data.aws_caller_identity.current.account_id}"
  force_destroy = true
}
resource "aws_s3_bucket_public_access_block" "build" {
  count                   = var.remote_build_enabled ? 1 : 0
  bucket                  = aws_s3_bucket.build[0].id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}
resource "aws_s3_object" "build" {
  count                  = var.remote_build_enabled ? 1 : 0
  bucket                 = aws_s3_bucket.build[0].id
  key                    = "source.zip"
  source                 = var.build_source_zip
  source_hash            = filemd5(var.build_source_zip)
  server_side_encryption = "AES256"
}
resource "aws_cloudwatch_log_group" "build" {
  count             = var.remote_build_enabled ? 1 : 0
  name              = "/aws/codebuild/${var.name}-build"
  retention_in_days = 7
}
resource "aws_iam_role" "build" {
  count = var.remote_build_enabled ? 1 : 0
  name  = "${var.name}-build"
  assume_role_policy = jsonencode({ Version = "2012-10-17", Statement = [{
    Effect = "Allow", Principal = { Service = "codebuild.amazonaws.com" }, Action = "sts:AssumeRole"
  }] })
}
resource "aws_iam_role_policy" "build" {
  count = var.remote_build_enabled ? 1 : 0
  role  = aws_iam_role.build[0].id
  policy = jsonencode({ Version = "2012-10-17", Statement = [
    { Effect = "Allow", Action = ["ecr:GetAuthorizationToken"], Resource = "*" },
    { Effect = "Allow", Action = ["ecr:BatchCheckLayerAvailability", "ecr:InitiateLayerUpload", "ecr:UploadLayerPart", "ecr:CompleteLayerUpload", "ecr:PutImage", "ecr:BatchGetImage", "ecr:GetDownloadUrlForLayer"], Resource = aws_ecr_repository.app.arn },
    { Effect = "Allow", Action = ["s3:GetObject", "s3:GetObjectVersion"], Resource = "${aws_s3_bucket.build[0].arn}/*" },
    { Effect = "Allow", Action = ["s3:GetBucketLocation", "s3:GetBucketAcl"], Resource = aws_s3_bucket.build[0].arn },
    { Effect = "Allow", Action = ["logs:CreateLogStream", "logs:PutLogEvents"], Resource = "${aws_cloudwatch_log_group.build[0].arn}:*" }
  ] })
}
resource "aws_codebuild_project" "image" {
  count         = var.remote_build_enabled ? 1 : 0
  name          = "${var.name}-build"
  service_role  = aws_iam_role.build[0].arn
  build_timeout = 15
  artifacts {
    type = "NO_ARTIFACTS"
  }
  environment {
    compute_type    = "BUILD_GENERAL1_SMALL"
    image           = "aws/codebuild/standard:7.0"
    type            = "LINUX_CONTAINER"
    privileged_mode = true
    environment_variable {
      name  = "IMAGE_URI"
      value = "${aws_ecr_repository.app.repository_url}:${var.build_image_tag}"
    }
    environment_variable {
      name  = "REGISTRY"
      value = split("/", aws_ecr_repository.app.repository_url)[0]
    }
  }
  source {
    type      = "S3"
    location  = "${aws_s3_bucket.build[0].bucket}/${aws_s3_object.build[0].key}"
    buildspec = <<-YAML
      version: 0.2
      phases:
        pre_build:
          commands:
            - aws ecr get-login-password --region "$AWS_DEFAULT_REGION" | docker login --username AWS --password-stdin "$REGISTRY"
        build:
          commands:
            - docker build --platform linux/amd64 -t "$IMAGE_URI" .
        post_build:
          commands:
            - docker push "$IMAGE_URI"
    YAML
  }
  logs_config {
    cloudwatch_logs {
      group_name = aws_cloudwatch_log_group.build[0].name
    }
  }
  lifecycle {
    precondition {
      condition     = var.cpu_architecture == "X86_64"
      error_message = "This remote builder produces linux/amd64; set X86_64."
    }
  }
  depends_on = [aws_iam_role_policy.build, aws_s3_bucket_public_access_block.build]
}
