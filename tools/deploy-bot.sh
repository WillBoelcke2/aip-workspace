#!/usr/bin/env bash
# Publica o robô das atas (função agendada das 6h). Rode no Google Cloud Shell: https://shell.cloud.google.com
#   ./tools/deploy-bot.sh        publica e mostra o passo do Admin Console
#   ./tools/deploy-bot.sh run        roda o robô das atas agora (para testar)
#   ./tools/deploy-bot.sh run seed   roda o Radar Seed agora
set -euo pipefail
PROJECT=aip-workspace
REGION=southamerica-east1
gcloud config set project "$PROJECT" >/dev/null
if [ "${1:-}" = "run" ]; then
  FN="atasBot"; SVC="atasbot"; [ "${2:-}" = "seed" ] && FN="seedRadar" && SVC="seedradar"
  gcloud scheduler jobs run "firebase-schedule-$FN-$REGION" --location="$REGION"
  echo "Disparado ($FN). Aguardando 90s pelo resultado..."; sleep 90
  gcloud logging read "resource.labels.service_name=\"$SVC\" AND jsonPayload.message=\"$FN\"" --limit=1 --freshness=10m --format='json(jsonPayload)'
  exit 0
fi
echo "1/4 Ativando as APIs necessárias..."
gcloud services enable iamcredentials.googleapis.com drive.googleapis.com gmail.googleapis.com aiplatform.googleapis.com cloudscheduler.googleapis.com cloudfunctions.googleapis.com run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com eventarc.googleapis.com pubsub.googleapis.com
NUM=$(gcloud projects describe "$PROJECT" --format='value(projectNumber)')
SA="$NUM-compute@developer.gserviceaccount.com"
echo "2/4 Permitindo que a função assine pedidos em nome próprio..."
gcloud iam service-accounts add-iam-policy-binding "$SA" --member="serviceAccount:$SA" --role=roles/iam.serviceAccountTokenCreator >/dev/null
for ROLE in roles/datastore.user roles/aiplatform.user roles/cloudbuild.builds.builder roles/logging.logWriter roles/artifactregistry.writer; do
  gcloud projects add-iam-policy-binding "$PROJECT" --member="serviceAccount:$SA" --role="$ROLE" --condition=None >/dev/null
done
echo "   (aguardando 30s para as permissões valerem)"; sleep 30
echo "3/4 Publicando a função..."
(cd functions && npm install --no-audit --no-fund)
firebase deploy --only functions --project "$PROJECT" --force
CID=$(gcloud iam service-accounts describe "$SA" --format='value(oauth2ClientId)')
cat <<MSG

4/4 Falta um passo, feito por um superadministrador do Google Workspace:
  1. Abra https://admin.google.com/ac/owl/domainwidedelegation
  2. Clique em "Adicionar novo"
  3. ID do cliente:  $CID
  4. Escopos OAuth (os dois, separados por vírgula):
     https://www.googleapis.com/auth/drive.meet.readonly,https://www.googleapis.com/auth/gmail.readonly
  5. Autorizar
  (Se o ID já estiver na lista, passe o mouse nele, clique em Editar e deixe os dois escopos.)

Depois, teste com:  ./tools/deploy-bot.sh run        (atas)
                    ./tools/deploy-bot.sh run seed   (Radar Seed)
MSG
