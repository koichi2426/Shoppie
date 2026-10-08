output "ecr_repository_url" {
  value = aws_ecr_repository.app.repository_url
}
output "alb_dns_name" {
  value = aws_lb.main.dns_name
}
output "cluster_name" {
  value = aws_ecs_cluster.main.name
}
output "service_name" {
  value = local.enabled ? aws_ecs_service.app[0].name : null
}
output "database_endpoint" {
  value = aws_db_instance.conversation.address
}
