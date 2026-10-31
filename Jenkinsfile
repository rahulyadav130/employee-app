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
    }
}
