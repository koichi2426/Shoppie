variables {
  image_uri              = ""
  ingress_cidrs          = []
  certificate_arn        = null
  desired_count          = 1
  mock_external_services = true
  autoscaling_enabled    = false
  remote_build_enabled   = false
}

mock_provider "aws" {
  mock_data "aws_availability_zones" {
    defaults = { names = ["ap-northeast-1a", "ap-northeast-1c"] }
  }
  mock_data "aws_partition" {
    defaults = { partition = "aws" }
  }
  mock_data "aws_caller_identity" {
    defaults = { account_id = "123456789012" }
  }
  mock_resource "aws_db_instance" {
    defaults = {
      master_user_secret = [{
        secret_arn    = "arn:aws:secretsmanager:ap-northeast-1:123456789012:secret:rds-test-abcdef"
        secret_status = "active"
        kms_key_id    = "test-key"
      }]
    }
  }
  mock_resource "aws_security_group" {
    defaults = { ingress = [] }
  }
  mock_resource "aws_lb" {
    defaults = { arn = "arn:aws:elasticloadbalancing:ap-northeast-1:123456789012:loadbalancer/app/test/1234567890123456" }
  }
  mock_resource "aws_lb_target_group" {
    defaults = { arn = "arn:aws:elasticloadbalancing:ap-northeast-1:123456789012:targetgroup/test/1234567890123456" }
  }
  mock_resource "aws_iam_role" {
    defaults = { arn = "arn:aws:iam::123456789012:role/test" }
  }
  mock_resource "aws_ecs_cluster" {
    defaults = { id = "arn:aws:ecs:ap-northeast-1:123456789012:cluster/test" }
  }
}

run "bootstrap" {
  command = apply
  assert {
    condition     = length(aws_ecs_service.app) == 0 && length(aws_ecs_task_definition.app) == 0
    error_message = "Bootstrap must not launch tasks before an image is pushed."
  }
  assert {
    condition     = !aws_db_instance.conversation.publicly_accessible && aws_db_instance.conversation.storage_encrypted
    error_message = "The shared database must be private and encrypted."
  }
  assert {
    condition     = length(aws_security_group.alb.ingress) == 0
    error_message = "The default validation ALB must not accept public traffic."
  }
}

run "two_tasks" {
  command = plan
  variables {
    image_uri     = "123456789012.dkr.ecr.ap-northeast-1.amazonaws.com/shoppie:validation"
    desired_count = 2
    ingress_cidrs = ["203.0.113.10/32"]
  }
  assert {
    condition     = aws_ecs_service.app[0].desired_count == 2 && length(aws_appautoscaling_target.app) == 0
    error_message = "Controlled comparison must run exactly two tasks without autoscaling."
  }
}

run "real_api_requires_https" {
  command = plan
  variables {
    image_uri              = "123456789012.dkr.ecr.ap-northeast-1.amazonaws.com/shoppie:validation"
    mock_external_services = false
  }
  expect_failures = [aws_ecs_task_definition.app]
}
