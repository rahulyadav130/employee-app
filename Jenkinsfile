pipeline {
    agent { label 'linux' }

    stages {
        stage('Test') {
            steps {
                sh 'node --version'
                sh 'npm ci'
                sh 'npm test'
                sh 'hostname'
                sh 'mkdir /tmp/testvscode'
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
