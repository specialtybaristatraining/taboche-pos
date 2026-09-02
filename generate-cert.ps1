# Generate self-signed certificate for development
$cert = New-SelfSignedCertificate -DnsName "localhost" -CertStoreLocation "cert:\LocalMachine\My"
$certPath = "cert:\LocalMachine\My\$($cert.Thumbprint)"
Export-Certificate -Cert $certPath -FilePath "cert.pem" -Type CERT
Export-PfxCertificate -Cert $certPath -FilePath "cert.pfx" -Password (ConvertTo-SecureString -String "password" -Force -AsPlainText)

# Export private key
$privateKey = [System.Security.Cryptography.X509Certificates.RSACertificateExtensions]::GetRSAPrivateKey($cert)
$privateKeyBytes = $privateKey.Key.Export([System.Security.Cryptography.CngKeyBlobFormat]::Pkcs8PrivateBlob)
[System.IO.File]::WriteAllBytes("key.pem", $privateKeyBytes)