pipeline {
    agent none

    options {
        buildDiscarder(logRotator(numToKeepStr: '20'))
        timeout(time: 1, unit: 'HOURS')
        disableConcurrentBuilds()
        timestamps()
    }

    environment {
        IMAGE_NAME = 'krahulyadav130/employee-app'
        IMAGE_TAG  = "${env.BRANCH_NAME == 'main' ? 'v' + env.BUILD_NUMBER : env.BRANCH_NAME + '-' + env.BUILD_NUMBER}"
        // IMAGE_TAG  = "v${env.BUILD_NUMBER}"
    }

    stages {
        stage('CI') {
            agent { label 'linux' }
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
                        '''
                    }
                }

                stage('Push Image') {
                    when { branch 'dev' }
                    steps {
                        withCredentials([usernamePassword(credentialsId: 'dockerhub',
                                                          usernameVariable: 'DH_USER',
                                                          passwordVariable: 'DH_TOKEN')]) {
                            sh '''
                                echo "$DH_TOKEN" | docker login -u "$DH_USER" --password-stdin
                                if [ "$BRANCH_NAME" = "main" ]; then
                                    docker tag $IMAGE_NAME:$IMAGE_TAG $IMAGE_NAME:latest
                                    docker push $IMAGE_NAME:latest
                                fi    
                                // docker push $IMAGE_NAME:$IMAGE_TAG
                                // docker tag $IMAGE_NAME:$IMAGE_TAG $IMAGE_NAME:latest
                                // docker push $IMAGE_NAME:latest
                            '''
                        }
                    }
                }
            }
            post {
                cleanup {
                    sh '''
                        docker logout || true
                        docker image rm $IMAGE_NAME:$IMAGE_TAG $IMAGE_NAME:latest || true
                    '''
                    cleanWs()
                }
            }
        }

        stage('Approval') {
            when { branch 'dev' }
            steps {
                timeout(time: 30, unit: 'MINUTES') {
                    input message: "Deploy ${env.IMAGE_TAG} to dev?",
                          ok: 'Deploy',
                          submitter: 'admin'
                }
            }
        }

        stage('Deploy') {
            when {
                beforeAgent true
                branch 'dev'
            }
            agent { label 'linux' }
            steps {
                withCredentials([file(credentialsId: 'kubeconfig-lab', variable: 'KUBECONFIG')]) {
                    sh '''
                        sed -i "s|image: $IMAGE_NAME:.*|image: $IMAGE_NAME:$IMAGE_TAG|" k8s/04-app.yaml
                        
                        grep "image:" k8s/04-app.yaml
                        kubectl apply -f k8s/
                        kubectl -n employee-app-dev annotate deployment/employee-app-dev \
                          kubernetes.io/change-cause="Jenkins $IMAGE_TAG" --overwrite
                        kubectl -n employee-app-dev rollout status deployment/employee-app-dev --timeout=180s
                    '''
                }
            }
            post {
                failure {
                    withCredentials([file(credentialsId: 'kubeconfig-lab', variable: 'KUBECONFIG')]) {
                        sh '''
                            echo "Deploy of $IMAGE_TAG failed, rolling back..."
                            kubectl -n employee-app-dev rollout undo deployment/employee-app-dev
                            kubectl -n employee-app-dev rollout status deployment/employee-app-dev --timeout=180s
                        '''
                    }
                }
                cleanup {
                    cleanWs()
                }
            }
        }
    }
}