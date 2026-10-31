pipeline {
    agent { label 'linux' }
     environment {
        IMAGE_NAME = 'krahulyadav130/employee-app'
    }

    stages {
        stage('Test') {
            steps {
                sh 'node --version'
                sh 'npm ci'
                sh 'npm test'
                sh 'hostname'
                
            }
        }
        stage('Build Image') {
            steps {
                sh '''
                    docker build \
                      --secret id=extra_ca,src=/etc/ssl/certs/ca-certificates.crt \
                      -t $IMAGE_NAME:$GIT_COMMIT .
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
                        docker push $IMAGE_NAME:$GIT_COMMIT
                        docker tag $IMAGE_NAME:$GIT_COMMIT $IMAGE_NAME:latest
                        docker push $IMAGE_NAME:latest
                        docker logout
                    '''
                }
            }
        }
    }
}
