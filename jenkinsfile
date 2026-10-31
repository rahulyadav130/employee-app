pipeline {
    agent { label 'linux' }

    stages {
        stage('Test') {
            steps {
                sh 'node --version'
                sh 'npm ci'
                sh 'npm test'
            }
        }
    }
}
