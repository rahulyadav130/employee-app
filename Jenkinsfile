pipeline {
    agent { label 'linux' }

    environment {
        IMAGE_NAME = 'krahulyadav130/employee-app'
        IMAGE_TAG  = "v${env.BUILD_NUMBER}"
    }

    stages {
        stage('Test') {
            steps {
                sh 'node --version'
                sh 'npm ci'
                sh 'npm test'
            }
        }

        stage('Build Image') {
            steps {
                sh '''
                    docker build \
                      --secret id=extra_ca,src=/etc/ssl/certs/ca-certificates.crt \
                      -t $IMAGE_NAME:$IMAGE_TAG .
                    docker images $IMAGE_NAME
                '''
            }
        }

        stage('Push Image') {
            when { branch 'main' }
            steps {
                withCredentials([usernamePassword(credentialsId: 'dockerhub',
                                                  usernameVariable: 'DH_USER',
                                                  passwordVariable: 'DH_TOKEN')]) {
                    sh '''
                        echo "$DH_TOKEN" | docker login -u "$DH_USER" --password-stdin
                         docker push $IMAGE_NAME:$IMAGE_TAG
                        docker tag $IMAGE_NAME:$IMAGE_TAG $IMAGE_NAME:latest
                        docker push $IMAGE_NAME:latest
                        docker logout
                    '''
                }
            }
        }
        stage('Approval') {
            when { branch 'main' }
            steps {
                timeout(time: 30, unit: 'MINUTES') {
                    input message: "Deploy ${env.IMAGE_TAG} to production?",
                          ok: 'Deploy',
                          submitter: 'admin'
                }
            }
        }
        stage('Deploy') {
            when { branch 'main' }
            steps {
                withCredentials([file(credentialsId: 'kubeconfig-lab', variable: 'KUBECONFIG')]) {
                    sh '''
                        sed -i "s|image: $IMAGE_NAME:.*|image: $IMAGE_NAME:$IMAGE_TAG|" k8s/04-app.yaml
                        grep "image:" k8s/04-app.yaml
                        kubectl apply -f k8s/04-app.yaml
                        kubectl -n employee-app rollout status deployment/employee-app --timeout=180s
                    '''
                }
            }
        }
    }
}