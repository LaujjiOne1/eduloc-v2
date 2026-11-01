# Intégration du service de paiement (eduloc-pay-subscriptions)

Deux services **sans base ni code partagés**. Ils ne communiquent que par trois échanges, tous authentifiés :

```
 Application EduLoc            Backend EduLoc                      Service de paiement (port 3001)
 ─────────────────             ──────────────                      ───────────────────────────────
 1. POST /api/bookings/:id/payments ─▶ émet un TICKET signé (HS256)
    ◀─ { payment, checkoutUrl }
 2. ouvre checkoutUrl dans une WebView ───────────────────────────▶ vérifie le ticket, affiche la page
                                                                     (Visa / Mobile Money), encaisse
 3.                                  ◀── POST /api/payments/webhook ─ notification SIGNÉE du résultat
 4. GET /api/payments/:id ─▶ statut stocké (+ vérification de serveur à serveur si PENDING) ─▶ GET /api/v1/payments/:id/status
```

L'application n'est **jamais** une source de vérité : la page « paiement réussi » et le retour `eduloc://payment/return` ne servent qu'à
déclencher une relecture du statut auprès du backend (SEC-06). Aucune route EduLoc n'accepte un montant, une capture d'écran ou une
référence saisie par le client comme preuve (MM-04).

## Activation

Tant que `PAYMENTS_ENABLED=false` (défaut), `POST /bookings/:id/payments` répond **503 `PAYMENTS_UNAVAILABLE`** et l'application affiche
« bientôt disponible ». Rien d'autre ne change.

| Variable | Rôle |
|---|---|
| `PAYMENTS_ENABLED` | `true` pour émettre des tickets. Exige les trois variables suivantes, sinon le backend refuse de démarrer. |
| `PAY_PUBLIC_URL` | Adresse **publique** de la page de paiement (celle que l'application ouvre). HTTPS obligatoire en production (SEC-01). |
| `PAY_TICKET_SECRET` | ≥ 32 caractères. Secret de signature des tickets (EduLoc → service de paiement). |
| `PAY_WEBHOOK_SECRET` | ≥ 32 caractères, **différent** du précédent. Secret de signature des notifications (service → EduLoc). |
| `PAY_API_URL`, `PAY_API_KEY` | Facultatifs. API du service pour la vérification de statut de serveur à serveur (MM-03). Sans eux, le statut ne vient que des notifications. |
| `PAY_TICKET_TTL_MINUTES` | Durée de vie du ticket (défaut 20). |

Les secrets ne vivent que dans l'environnement serveur (SEC-02) ; ils ne sont ni dans l'application, ni dans le dépôt.

## 1. Ticket (EduLoc → page de paiement)

L'application ouvre `{PAY_PUBLIC_URL}/checkout#ticket=<jeton>`. Le jeton est dans le **fragment** : il n'est jamais envoyé au serveur
web ni inscrit dans ses journaux. C'est un **JWT HS256** à vérifier avec `PAY_TICKET_SECRET` :

| Claim | Sens |
|---|---|
| `iss` = `eduloc-api`, `aud` = `eduloc-pay` | À vérifier. |
| `exp`, `iat`, `jti` | Courte durée ; `jti` unique par ouverture. Refuser un ticket expiré. |
| `sub` | **Identifiant du paiement EduLoc** (UUID). Clé de tout l'échange (et clé d'idempotence côté service de paiement). |
| `reservation_id` | Identifiant de la réservation EduLoc. |
| `amount`, `currency` | Montant décimal en chaîne (`"47000.00"`) et devise (`MGA`). **Calculés par le backend** : la page n'a aucun champ de montant modifiable (SEC-03). |
| `customer_name`, `customer_email` | Pour le reçu et la page. |
| `description` | Libellé à afficher (« Mathématiques — Lova R. »). |
| `return_url` | `eduloc://payment/return?payment=<id>` : où ramener l'utilisateur. |
| `callback_url` | Où poster la notification (étape 3). |

Le service de paiement doit : rejeter tout algorithme autre que HS256 (jamais `none`), vérifier `exp`/`iss`/`aud`, puis n'utiliser **que** les
valeurs du ticket (jamais un montant venu du navigateur). Fin de parcours : naviguer vers `return_url` (ou
`window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'eduloc:payment:done', payment: <id> }))`). Les deux ne font que provoquer une
relecture du statut.

## 2. Saisie des moyens de paiement (VISA-01..04, MM-01..04)

- **Carte** : champs ou page hébergés par le prestataire conforme PCI DSS ; Visa Secure / 3-D Secure dans le parcours de la banque. EduLoc ne voit jamais
  ni numéro, ni CVV. Une authentification 3-D Secure réussie **n'est pas** un paiement réussi : seul le résultat financier du prestataire l'est.
- **Mobile Money** : confirmation par l'utilisateur dans le canal officiel de l'opérateur ; **jamais** de PIN demandé ni enregistré. Une demande
  acceptée (`202`) est un `PENDING`, pas un succès.

## 3. Notification (service de paiement → EduLoc)

`POST {callback_url}` — `Content-Type: application/json`, en-tête :

```
X-Eduloc-Pay-Signature: t=<secondes Unix>,v1=<hex(HMAC-SHA256(PAY_WEBHOOK_SECRET, "<t>.<corps brut>"))>
```

La signature porte sur le **corps brut exact** envoyé. Tolérance d'horloge : ±5 minutes (les rejeux plus anciens sont refusés).

```json
{
  "event_id": "evt_01J9...",            // unique par notification (≥ 8 caractères) : un rejeu n'est jamais appliqué deux fois (SEC-07)
  "type": "payment.updated",
  "data": {
    "payment_id": "<sub du ticket>",
    "reservation_id": "<reservation_id du ticket>",
    "status": "SUCCEEDED",              // PENDING | PROCESSING | REQUIRES_ACTION | SUCCEEDED | FAILED | CANCELLED | EXPIRED
    "amount": "47000.00",               // OBLIGATOIRES avec SUCCEEDED : montant et devise réellement encaissés
    "currency": "MGA",
    "method": "visa_stripe",            // visa_stripe | mobile_money
    "provider": "stripe",               // stripe | orange-money | mvola | airtel-money …
    "provider_ref": "pi_123",
    "card_brand": "visa",               // cartes : marque + 4 derniers chiffres UNIQUEMENT
    "card_last4": "4242",
    "failure_reason": "timeout"         // facultatif
  }
}
```

Réponses : `200 { received, applied }` (aussi pour un rejeu), `403` signature invalide, `404` paiement inconnu, `422` incohérence (réservation, devise ou
montant différents de ceux figés dans le ticket, ou `SUCCEEDED` sans montant/devise) — à traiter comme **anomalie à examiner**, pas à rejouer.
Réessayer avec le **même** `event_id` en cas d'erreur réseau ou 5xx.

États (MM-02) : tout ce qui n'est pas final (`PENDING`, `PROCESSING`, `REQUIRES_ACTION`…) reste `PENDING` côté EduLoc. `SUCCEEDED` est terminal ; un
`SUCCEEDED` confirmé après un `FAILED`/`CANCELLED`/`EXPIRED` est accepté (l'argent a bougé) mais journalisé comme anomalie (SEC-11).

## 4. Vérification de statut (EduLoc → service de paiement, facultatif mais recommandé)

Si une notification se perd, le backend interroge, au plus toutes les 10 s par paiement :

```
GET {PAY_API_URL}/api/v1/payments/{payment_id}/status
Authorization: Bearer {PAY_API_KEY}
→ 200 { "state": "SUCCEEDED", "verified_amount": "47000.00", "currency": "MGA", "verified_at": "…",
        "method": "visa_stripe", "provider": "stripe", "provider_ref": "pi_123", "card_brand": "visa", "card_last4": "4242" }
```

Même contrôle de cohérence que pour une notification. Service injoignable ou réponse invalide : le statut connu est conservé (jamais un échec).

## Ce que le backend vérifie avant de passer un paiement à `SUCCEEDED`

Référence de réservation, montant et devise (contre ceux **figés** à l'émission du ticket), signature (webhook) ou appel authentifié (statut), absence de rejeu.
Journal d'audit `payment_events` : aucun CVV, PIN, numéro de carte, jeton ni signature n'y est enregistré (SEC-10).

## Tester sans le service de paiement

```
npx tsx scripts/pay-simulate.ts <payment_id> <booking_id> <amount> [SUCCEEDED|FAILED|PENDING] [visa|mobile]
```

envoie à `API_URL` une notification correctement signée avec `PAY_WEBHOOK_SECRET` (lu dans `.env`).

## À décider côté produit

- **Quand payer** : aujourd'hui une réservation est payable dès qu'elle est confirmée par le tuteur (`CONFIRMED`, `IN_PROGRESS`, `COMPLETED` —
  `PAYABLE_BOOKING_STATUSES`). Le paiement ne change **pas** le statut de la réservation (couplage faible) ; à relier si le métier l'exige.
- **Remboursements** et rapprochement quotidien (SEC-11) : non implémentés ici.
- **Odoo** : le CRM ne doit recevoir que des métadonnées de suivi (section 4 du cahier des charges) ; non branché.
