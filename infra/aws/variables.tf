variable "region" {
  type    = string
  default = "ap-northeast-1"
}
variable "name" {
  type    = string
  default = "shoppie-validation"
}
variable "image_uri" {
  description = "Immutable ECR image URI. Empty creates infrastructure only, without an ECS service."
  type        = string
  default     = ""
}
variable "ingress_cidrs" {
  description = "Clients permitted to access the validation ALB. Set your public IP /32."
  type        = list(string)
  default     = []
  validation {
    condition     = alltrue([for cidr in var.ingress_cidrs : can(cidrnetmask(cidr))])
    error_message = "Use IPv4 CIDR notation."
  }
}
variable "certificate_arn" {
  description = "Issued ACM certificate in this region. Required before using real external APIs."
  type        = string
  default     = null
}
variable "desired_count" {
  type    = number
  default = 1
  validation {
    condition     = contains([1, 2], var.desired_count)
    error_message = "The initial comparison uses one or two tasks."
  }
}
variable "mock_external_services" {
  description = "Use fixed-delay fake Bedrock and marketplaces for the first capacity comparison."
  type        = bool
  default     = true
}
variable "bedrock_region" {
  type    = string
  default = "us-east-1"
}
variable "bedrock_model_id" {
  type    = string
  default = "us.anthropic.claude-haiku-4-5-20251001-v1:0"
}
variable "secret_env" {
  description = "Environment variable => Secrets Manager ARN (optionally with :json-key:: suffix)."
  type        = map(string)
  default     = {}
}
variable "autoscaling_enabled" {
  description = "Leave disabled during controlled one/two-task comparisons."
  type        = bool
  default     = false
}
variable "requests_per_target" {
  description = "ALB requests per target per minute; calibrate using measured capacity."
  type        = number
  default     = 30
}
variable "database_deletion_protection" {
  type    = bool
  default = true
}
variable "database_skip_final_snapshot" {
  description = "True only when disposing of an explicitly disposable validation DB."
  type        = bool
  default     = false
}
variable "ecr_force_delete" {
  description = "Remove validation images when deleting the repository."
  type        = bool
  default     = false
}
variable "postgres_version" {
  type    = string
  default = "18.3"
}
variable "cpu_architecture" {
  type    = string
  default = "X86_64"
  validation {
    condition     = contains(["ARM64", "X86_64"], var.cpu_architecture)
    error_message = "Set ARM64 or X86_64, matching the pushed image."
  }
}
variable "remote_build_enabled" {
  type    = bool
  default = false
}
variable "build_source_zip" {
  type    = string
  default = ""
}
variable "build_image_tag" {
  type    = string
  default = "validation"
}
