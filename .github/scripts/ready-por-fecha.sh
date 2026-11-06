#!/usr/bin/env bash
# Pasa a Ready las tarjetas que siguen en Backlog y cuya fecha de inicio
# ya llegó (hoy o antes), según el calendario de America/Santiago.
# No toca In progress, In review, Done ni Ready.
set -euo pipefail

if [[ -z "${GH_TOKEN:-}" ]]; then
  if [[ -n "${GITHUB_ACTIONS:-}" ]]; then
    echo "Falta el secret PROJECT_TOKEN. Tiene que ser un PAT clásico del dueño del tablero, con el scope project."
    exit 1
  fi
  echo "Sin GH_TOKEN: se usa la sesión local de gh."
fi

command -v jq >/dev/null
command -v gh >/dev/null

TODAY="$(TZ=America/Santiago date +%F)"
echo "Hoy en America/Santiago: ${TODAY}"

FIELDS_QUERY='query {
  user(login: "CEOAlmaloco") {
    projectV2(number: 8) {
      id
      fields(first: 30) {
        nodes {
          ... on ProjectV2SingleSelectField {
            id
            name
            options { id name }
          }
        }
      }
    }
  }
}'

FIELDS="$(gh api graphql -f query="${FIELDS_QUERY}")"
PROJECT_ID="$(jq -r '.data.user.projectV2.id' <<<"${FIELDS}")"
STATUS_FIELD="$(jq -r '.data.user.projectV2.fields.nodes[] | select(.name == "Status") | .id' <<<"${FIELDS}")"
READY_ID="$(jq -r '.data.user.projectV2.fields.nodes[] | select(.name == "Status") | .options[] | select(.name == "Ready") | .id' <<<"${FIELDS}")"

if [[ -z "${PROJECT_ID}" || "${PROJECT_ID}" == "null" || -z "${STATUS_FIELD}" || "${STATUS_FIELD}" == "null" || -z "${READY_ID}" || "${READY_ID}" == "null" ]]; then
  echo "No se encontró el proyecto, el campo Status o la opción Ready."
  exit 1
fi

PAGE_QUERY='query($cursor: String) {
  user(login: "CEOAlmaloco") {
    projectV2(number: 8) {
      items(first: 50, after: $cursor) {
        pageInfo { hasNextPage endCursor }
        nodes {
          id
          content {
            __typename
            ... on Issue { number title state }
            ... on PullRequest { number title state }
            ... on DraftIssue { title }
          }
          fieldValues(first: 25) {
            nodes {
              ... on ProjectV2ItemFieldSingleSelectValue {
                name
                field { ... on ProjectV2SingleSelectField { name } }
              }
              ... on ProjectV2ItemFieldDateValue {
                date
                field { ... on ProjectV2FieldCommon { name } }
              }
            }
          }
        }
      }
    }
  }
}'

MUTATION='mutation($project: ID!, $item: ID!, $field: ID!, $option: String!) {
  updateProjectV2ItemFieldValue(input: {
    projectId: $project
    itemId: $item
    fieldId: $field
    value: { singleSelectOptionId: $option }
  }) { projectV2Item { id } }
}'

cursor=""
moved=0
checked=0

while true; do
  if [[ -z "${cursor}" ]]; then
    PAGE="$(gh api graphql -f query="${PAGE_QUERY}")"
  else
    PAGE="$(gh api graphql -f query="${PAGE_QUERY}" -f cursor="${cursor}")"
  fi

  if jq -e '.errors' >/dev/null <<<"${PAGE}"; then
    echo "La consulta del tablero falló:"
    jq '.errors' <<<"${PAGE}"
    exit 1
  fi

  while IFS=$'\t' read -r item_id number title state status start; do
    [[ -z "${item_id}" ]] && continue
    checked=$((checked + 1))
    if [[ "${state}" == "CLOSED" || "${state}" == "MERGED" ]]; then
      continue
    fi
    if [[ "${status}" != "Backlog" || -z "${start}" || "${start}" > "${TODAY}" ]]; then
      continue
    fi

    label="#${number} ${title}"
    if [[ -z "${number}" ]]; then
      label="${title}"
    fi

    if [[ "${DRY_RUN:-0}" == "1" ]]; then
      echo "DRY  ${label}  inicio ${start}  Backlog -> Ready"
    else
      gh api graphql -f query="${MUTATION}" \
        -f project="${PROJECT_ID}" \
        -f item="${item_id}" \
        -f field="${STATUS_FIELD}" \
        -f option="${READY_ID}" >/dev/null
      echo "OK   ${label}  inicio ${start}  Backlog -> Ready"
    fi
    moved=$((moved + 1))
  done < <(jq -r '
    .data.user.projectV2.items.nodes[]
    | [
        .id,
        (.content.number // ""),
        ((.content.title // "") | gsub("[\t\r\n]"; " ")),
        (.content.state // "OPEN"),
        (([.fieldValues.nodes[]? | select(.field.name? == "Status") | .name][0]) // ""),
        (([.fieldValues.nodes[]? | select(.field.name? == "Start date") | .date][0]) // "")
      ]
    | @tsv
  ' <<<"${PAGE}")

  has_next="$(jq -r '.data.user.projectV2.items.pageInfo.hasNextPage' <<<"${PAGE}")"
  if [[ "${has_next}" != "true" ]]; then
    break
  fi
  cursor="$(jq -r '.data.user.projectV2.items.pageInfo.endCursor' <<<"${PAGE}")"
done

echo "Revisadas: ${checked}. Pasadas a Ready: ${moved}."
