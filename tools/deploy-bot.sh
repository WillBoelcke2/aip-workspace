#!/usr/bin/env bash
# Publica o robô das atas (função agendada das 6h). Rode no Google Cloud Shell: https://shell.cloud.google.com
#   ./tools/deploy-bot.sh        publica e mostra o passo do Admin Console
#   ./tools/deploy-bot.sh run    roda o robô agora (para testar)
set -euo pipefail
PROJECT=aip-workspace
REGION=southamerica-east1
gcloud config set project "$PROJECT" >/dev/null
if [ "${1:-}" = "run" ]; then
  gcloud scheduler jobs run "firebase-schedule-atasBot-$REGION" --location="$REGION"
  echo "Disparado. Em 1 a 2 minutos veja o resultado com:"
  echo "  gcloud functions logs read atasBot --region=$REGION --limit=20"
  exit 0
fi
echo "1/4 Ativando as APIs necessárias..."
gcloud services enable iamcredentials.googleapis.com drive.googleapis.com cloudscheduler.googleapis.com cloudfunctions.googleapis.com run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com eventarc.googleapis.com pubsub.googleapis.com
NUM=$(gcloud projects describe "$PROJECT" --format='value(projectNumber)')
SA="$NUM-compute@developer.gserviceaccount.com"
echo "2/4 Permitindo que a função assine pedidos em nome próprio..."
gcloud iam service-accounts add-iam-policy-binding "$SA" --member="serviceAccount:$SA" --role=roles/iam.serviceAccountTokenCreator >/dev/null
gcloud projects add-iam-policy-binding "$PROJECT" --member="serviceAccount:$SA" --role=roles/datastore.user --condition=None >/dev/null
echo "3/4 Publicando a função..."
(cd functions && npm install --no-audit --no-fund)
firebase deploy --only functions --project "$PROJECT" --force
CID=$(gcloud iam service-accounts describe "$SA" --format='value(oauth2ClientId)')
cat <<MSG

4/4 Falta um passo, feito por um superadministrador do Google Workspace:
  1. Abra https://admin.google.com/ac/owl/domainwidedelegation
  2. Clique em "Adicionar novo"
  3. ID do cliente:  $CID
  4. Escopos OAuth:  https://www.googleapis.com/auth/drive.meet.readonly
  5. Autorizar

Depois, teste com:  ./tools/deploy-bot.sh run
MSG
