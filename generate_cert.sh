#!/bin/bash
#! generate self-signed SSL certificate
#! (openssl) library is required to generate your own certificate
#!(openssl req) command asks for a “challenge password”
#!This password is used by Certificate Authorities to authenticate the certificate owner when they want to revoke their certificate.

openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes
