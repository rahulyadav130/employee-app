# Employee Entry App: Build, Run, Deploy and Go Live

This project is a small but complete example of a real-world delivery pipeline:

1. A **Node.js + Express** web app with an **employee entry form** and a **MySQL** database.
2. A **Dockerfile** that packages the app into a container image.
3. **Kubernetes manifests** that run the app and MySQL together in one cluster.
4. A **GitHub Actions** pipeline that tests, builds, pushes and deploys every change to `main`.

Work through the parts in order. Each part ends with a check, so you know it worked before moving on.

---

## 0. Project layout

```
employee-app/
├── src/
│   ├── server.js              # Express app, health probes, graceful shutdown
│   ├── db.js                  # MySQL pool, table creation, startup retry
│   ├── validate.js            # Server-side validation rules
│   └── routes/employees.js    # REST API: list, create, delete
├── public/                    # The entry form and employee table (HTML/CSS/JS)
├── test/validate.test.js      # Unit tests (run with: npm test)
├── Dockerfile                 # Builds the production image
├── docker-compose.yml         # Runs MySQL + app on your laptop
├── k8s/                       # Kubernetes manifests, applied in numeric order
│   ├── 00-namespace.yaml
│   ├── 01-mysql-pvc.yaml
│   ├── 02-mysql.yaml
│   ├── 03-app-config.yaml
│   └── 04-app.yaml
├── .github/workflows/ci-cd.yml  # The pipeline
├── .env.example               # Local environment variables template
└── package.json
```

The API the form talks to:

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/employees` | List employees |
| POST | `/api/employees` | Create an employee (validated, returns 201) |
| DELETE | `/api/employees/:id` | Delete an employee |
| GET | `/healthz` | Liveness probe: is the process alive? |
| GET | `/readyz` | Readiness probe: can it reach MySQL? |

---

## Part 1: Run it on your laptop without Docker

You need Node.js 20 or newer and a running MySQL 8 (or MariaDB).

**1.1 Install dependencies**

```bash
cd employee-app
npm install
```

**1.2 Start MySQL and create the database and user**

Connect as an admin user and run:

```sql
CREATE DATABASE employees CHARACTER SET utf8mb4;
CREATE USER 'empapp'@'localhost' IDENTIFIED BY 'apppass-local';
GRANT ALL PRIVILEGES ON employees.* TO 'empapp'@'localhost';
FLUSH PRIVILEGES;
```

Note the principle here: the app uses its own user with rights only on its own database, never `root`.

**1.3 Start the app**

```bash
export DB_HOST=localhost DB_USER=empapp DB_PASSWORD=apppass-local DB_NAME=employees PORT=3000
npm start
```

You should see `Database ready: employees table is in place` and `Employee app listening on port 3000`. The table is created automatically on first start.

**1.4 Check it**

Open http://localhost:3000, add an employee, and confirm the row appears in the table. Then from a terminal:

```bash
curl http://localhost:3000/readyz      # {"status":"ready","database":"up"}
npm test                               # 7 passing tests
```

---

## Part 2: Run it with Docker Compose (closest to production on your laptop)

Docker Compose starts MySQL and the app together, the same way Kubernetes will.

**2.1 Start everything**

```bash
docker compose up --build
```

The `app` service waits for MySQL's health check to pass before starting, which is the same idea as the readiness probe in Kubernetes.

**2.2 Check it**

Open http://localhost:3000. To stop everything, press `Ctrl+C`, then run `docker compose down`. Add `-v` to `down` if you also want to delete the database volume.

**2.3 Build the image by itself**

```bash
docker build -t employee-app:local .
docker run --rm -p 3000:3000 \
  -e DB_HOST=host.docker.internal -e DB_USER=empapp \
  -e DB_PASSWORD=apppass-local -e DB_NAME=employees \
  employee-app:local
```

What the Dockerfile does: it installs only production dependencies in one stage, copies just the needed files into a clean small runtime stage, and runs as the non-root `node` user. The `.dockerignore` file keeps secrets, `node_modules` and the k8s folder out of the image.

---

## Part 3: Deploy to Kubernetes

### 3.1 Get a cluster

Pick one option:

- **Local, for learning:** install [kind](https://kind.sigs.k8s.io/) (`kind create cluster --name emp`) or Minikube (`minikube start`).
- **Cloud:** AKS, EKS or GKE. Your Azure background fits AKS well: `az aks get-credentials --resource-group <rg> --name <cluster>`.

Confirm `kubectl` can reach it:

```bash
kubectl get nodes
```

### 3.2 Install an Ingress controller

The Ingress in `04-app.yaml` needs an Ingress controller. Install ingress-nginx:

```bash
helm upgrade --install ingress-nginx ingress-nginx \
  --repo https://kubernetes.github.io/ingress-nginx \
  --namespace ingress-nginx --create-namespace
```

No Helm? Use `kubectl apply -f` with the manifest URL from the ingress-nginx install docs for your platform. For kind, use the kind-specific manifest from the same docs.

Find the external IP (it can take a minute):

```bash
kubectl get svc -n ingress-nginx ingress-nginx-controller
```

### 3.3 Put your image name into the manifest

In `k8s/04-app.yaml`, replace `YOUR_GITHUB_USER` with your GitHub username (lowercase). Also set the `host:` line in the Ingress. For a quick test with no DNS, use nip.io: `employee.<EXTERNAL-IP>.nip.io`.

For a **local kind cluster**, you have no registry to pull from, so load the image directly:

```bash
docker build -t employee-app:local .
kind load docker-image employee-app:local --name emp
```

and set the image in `k8s/04-app.yaml` to `employee-app:local` before applying in step 3.5.

### 3.4 Create the secrets (never commit these)

Passwords are kept out of Git and out of the image. Create the Secret directly in the cluster:

```bash
kubectl create namespace employee-app

kubectl -n employee-app create secret generic mysql-secret \
  --from-literal=MYSQL_ROOT_PASSWORD='use-a-long-random-root-password' \
  --from-literal=MYSQL_PASSWORD='use-a-different-app-password'
```

Generate strong values with `openssl rand -base64 24`. The config map `03-app-config.yaml` holds the non-secret settings (host, port, database name, user).

### 3.5 Apply the manifests in order

```bash
kubectl apply -f k8s/00-namespace.yaml
kubectl apply -f k8s/01-mysql-pvc.yaml
kubectl apply -f k8s/02-mysql.yaml
kubectl apply -f k8s/03-app-config.yaml
kubectl apply -f k8s/04-app.yaml
```

Order matters: the namespace must exist first, and the ConfigMap must exist before MySQL starts (MySQL reads its database name and user from it).

### 3.6 Verify the rollout

```bash
kubectl -n employee-app get pods -w          # wait until all show Running and READY 1/1
kubectl -n employee-app get pvc              # mysql-data should be Bound
kubectl -n employee-app logs deploy/employee-app   # look for "Database ready"
```

If the app pods restart or show `0/1 Ready`, it is almost always the database. Check `kubectl -n employee-app logs deploy/mysql` and `kubectl -n employee-app describe pod <pod-name>`.

### 3.7 Open the app

Through the Ingress, open `http://employee.<EXTERNAL-IP>.nip.io` in your browser.

Without an Ingress (quickest for debugging), port-forward instead:

```bash
kubectl -n employee-app port-forward svc/employee-app 8080:80
```

Then open http://localhost:8080.

### 3.8 Useful day-to-day commands

```bash
kubectl -n employee-app get all                       # everything in the namespace
kubectl -n employee-app rollout history deploy/employee-app
kubectl -n employee-app rollout undo deploy/employee-app   # roll back to the previous version
kubectl -n employee-app exec -it deploy/mysql -- mysql -uempapp -p employees   # open a DB shell
```

---

## Part 4: Set up CI/CD with GitHub Actions

### 4.1 Put the code in GitHub

```bash
cd employee-app
git init -b main
git add .
git commit -m "Initial employee app"
gh repo create employee-app --private --source=. --push
```

(Or create the repo on github.com and push with `git remote add origin ...` and `git push -u origin main`.)

### 4.2 Allow the pipeline to push images

The workflow uses the built-in `GITHUB_TOKEN`, which already has permission to write to GitHub Container Registry (GHCR). Once the first image is pushed, go to your profile, **Packages**, `employee-app`, **Package settings**, and either make it **Public** (simplest) or keep it private and follow step 4.5.

### 4.3 Give the pipeline access to your cluster

The deploy job needs a kubeconfig. Do not use your personal admin one for real work; the proper approach is a ServiceAccount with rights only in the `employee-app` namespace. For learning, encode your existing kubeconfig:

```bash
base64 -w 0 ~/.kube/config > kubeconfig.b64      # macOS: base64 -i ~/.kube/config -o kubeconfig.b64
```

Then in GitHub: **Settings, Secrets and variables, Actions, New repository secret**. Name it `KUBECONFIG_B64` and paste the contents of `kubeconfig.b64`. Delete the `.b64` file afterwards.

> **Important:** the cluster must be reachable from GitHub's servers. A local kind or Minikube cluster is not reachable from the internet. For a local cluster, install a **self-hosted runner** on your machine (GitHub: Settings, Actions, Runners, New self-hosted runner) and change `runs-on: ubuntu-latest` on the deploy job to `runs-on: self-hosted`.

### 4.4 Create the production environment (optional but recommended)

In **Settings, Environments**, create `production`. Add yourself under **Required reviewers**. Now every deploy pauses until you approve it, which is a good habit to learn early.

### 4.5 Pull the private image (only if you kept the package private)

Create a registry credential secret and reference it from the Deployment:

```bash
kubectl -n employee-app create secret docker-registry ghcr-pull \
  --docker-server=ghcr.io \
  --docker-username=<github-user> \
  --docker-password=<a-PAT-with-read:packages>
```

Then add to `spec.template.spec` in `k8s/04-app.yaml`:

```yaml
      imagePullSecrets:
        - name: ghcr-pull
```

### 4.6 Ship a change

Make a small visible change (for example, the page title in `public/index.html`), then:

```bash
git add . && git commit -m "Change page title" && git push origin main
```

Watch the **Actions** tab. The three jobs run in order:

1. **Test** runs `npm ci` and `npm test`. A failing test stops everything.
2. **Build** builds the image and pushes it as `ghcr.io/<you>/employee-app:<commit-sha>`.
3. **Deploy** applies the manifests, points the Deployment at the new SHA tag, and waits for `rollout status`. If new pods never become ready, the job fails and the old pods keep serving traffic thanks to `maxUnavailable: 0`.

Open a pull request first to see the test and build steps run without deploying. That is the safe workflow on a real team.

---

## Part 5: Go-live checklist

Before you tell anyone the URL, run through this list:

- [ ] `npm test` passes locally and in the Actions tab.
- [ ] `docker compose up` works on your laptop.
- [ ] Secrets were created in the cluster and are not in Git (`git grep -i password` shows only the placeholders in this guide).
- [ ] `kubectl -n employee-app get pods` shows all pods `1/1 Ready`.
- [ ] The app loads, you can add an employee, and it survives a pod restart: run `kubectl -n employee-app delete pod -l app=employee-app`, then refresh the page.
- [ ] The data survives a database restart: `kubectl -n employee-app rollout restart deploy/mysql`, then check that the employee is still listed.
- [ ] You know how to roll back (`kubectl rollout undo`) and have tried it once.
- [ ] A test deploy from `main` went green end to end.

---

## Part 6: Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| App pods `CrashLoopBackOff`, logs show `ER_ACCESS_DENIED_ERROR` | Password in `mysql-secret` does not match what MySQL initialised with | MySQL only reads the password on first start with an empty volume. Delete the PVC (`kubectl -n employee-app delete pvc mysql-data`) to re-initialise, or change the password inside MySQL. |
| App shows `0/1 Ready` | `/readyz` failing: database unreachable | `kubectl -n employee-app logs deploy/mysql`; confirm the Service name `mysql` and `DB_HOST` match. |
| `ImagePullBackOff` | Image name wrong, package private, or image not pushed | Check the image path in `04-app.yaml`; follow step 4.5. |
| Pipeline `deploy` fails with `Unauthorized` | `KUBECONFIG_B64` wrong or expired | Regenerate and re-paste the secret. |
| Pipeline `deploy` cannot connect to the server | Cluster is local, behind a firewall, or has an IP allow-list | Use a self-hosted runner (step 4.3). |
| Browser shows 502/404 at the ingress host | No Ingress controller, or wrong `host:` value | Check `kubectl get ingress -n employee-app`; use port-forward to isolate the problem. |

---

## Part 7: What is still missing before a real production launch

This is the honest list. The project above is a solid foundation, but a production system needs more. Here they are in rough priority order.

**Security**

- **The form has no login.** Anyone who finds the URL can add or delete employees. Add authentication before real data goes in: for example Microsoft Entra ID (Azure AD) sign-in via OIDC, or an oauth2-proxy sidecar in front of the app.
- **TLS (HTTPS).** The example uses plain HTTP. Install cert-manager with Let's Encrypt and add a `tls:` section and annotation to the Ingress.
- **Secrets management.** Secrets are created by hand right now. Production teams use Sealed Secrets, External Secrets Operator with Azure Key Vault, or HashiCorp Vault, so secrets are versioned or fetched securely rather than typed in.
- **Least-privilege CI access.** The pipeline uses a kubeconfig that may be far too powerful. Create a ServiceAccount limited to the `employee-app` namespace with a Role and RoleBinding, and generate the kubeconfig from its token.
- **Image scanning and pinning.** Add a Trivy scan step to the pipeline, pin base images to a specific version (or digest) instead of `node:22-alpine` floating, and enable Dependabot for npm and Docker updates.
- **Network policy.** Only the app should be allowed to talk to MySQL. A NetworkPolicy enforces that.
- **Input and transport hardening.** Add `helmet` for security headers and `express-rate-limit` for abuse protection on the POST endpoint.

**Database**

- **Backups.** Nothing backs up the data yet. Add a Kubernetes CronJob that runs `mysqldump` to object storage (Azure Blob), and test a restore. A backup you have never restored is not a backup.
- **StatefulSet instead of Deployment for MySQL.** A StatefulSet gives a stable pod identity and ordered storage, which is the right primitive for databases. The Deployment with one replica works for learning.
- **Schema migrations.** `CREATE TABLE IF NOT EXISTS` is fine for one table, but real projects use a migration tool (Flyway, Knex migrations or Liquibase) so schema changes are versioned and reviewed.
- **Managed database.** For production, consider Azure Database for MySQL Flexible Server instead of running MySQL yourself. It handles backups, patching and failover.

**Delivery and operations**

- **Environments.** Add a `staging` namespace (or cluster) that deploys from a branch or pull request before `production`. Promote the same image SHA rather than rebuilding.
- **Tests beyond unit tests.** Add API tests (for example with `supertest`) that exercise the real routes against a throwaway MySQL, and a browser test with Playwright for the form.
- **Linting and formatting.** Add ESLint and Prettier and run them in the pipeline.
- **Observability.** Add Prometheus metrics (`prom-client`), dashboards in Grafana, and centralised logs (for example Azure Monitor or Loki). Right now you only have `kubectl logs`.
- **Autoscaling and availability.** Add a HorizontalPodAutoscaler for the app, a PodDisruptionBudget so node maintenance cannot take all pods down, and spread replicas across nodes with topology constraints.
- **Packaging.** Once you have several environments, convert the YAML to a Helm chart or Kustomize overlays so differences between staging and production are explicit values rather than copied files.
- **Rollback automation.** The pipeline should automatically roll back if `rollout status` fails. Right now it just fails and leaves a human to act.
- **Resource governance.** Add a ResourceQuota and LimitRange to the namespace so one workload cannot consume the whole cluster.
- **Runbook and ownership.** Write down who gets paged, what the common failures are, and how to restore from backup. The troubleshooting table above is the start.

**Application**

- **Pagination and search** on the employee list once there are hundreds of rows.
- **Editing employees.** Only create and delete are implemented; add a PUT route and an edit form.
- **Unique phone numbers and duplicate detection by name and date of birth**, depending on your business rules.
- **Audit trail.** Record who created or deleted each employee and when.

If you tackle these in order, each one is a good learning milestone on the CI/CD path: authentication and TLS first, then backups, then staging and observability.
