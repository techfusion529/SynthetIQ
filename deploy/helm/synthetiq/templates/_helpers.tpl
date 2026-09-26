{{/*
SynthetIQ Helm Template Helpers
*/}}

{{/*
Expand the name of the chart.
*/}}
{{- define "synthetiq.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "synthetiq.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- printf "%s" $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}

{{/*
Common labels for all resources.
*/}}
{{- define "synthetiq.labels" -}}
helm.sh/chart: {{ .Chart.Name }}-{{ .Chart.Version | replace "+" "_" }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/part-of: synthetiq
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
environment: {{ .Values.global.environment }}
{{- end }}

{{/*
Selector labels for a specific component.
Usage: {{ include "synthetiq.selectorLabels" (dict "component" "api" "root" .) }}
*/}}
{{- define "synthetiq.selectorLabels" -}}
app.kubernetes.io/name: synthetiq
app.kubernetes.io/component: {{ .component }}
app.kubernetes.io/instance: {{ .root.Release.Name }}
{{- end }}

{{/*
Pod annotations for Prometheus scraping.
Usage: {{ include "synthetiq.prometheusAnnotations" (dict "path" "/metrics" "port" "8000") }}
*/}}
{{- define "synthetiq.prometheusAnnotations" -}}
prometheus.io/scrape: "true"
prometheus.io/path: {{ .path | quote }}
prometheus.io/port: {{ .port | quote }}
{{- end }}
