# coding: utf-8
import datetime
import hashlib
import hmac
import json
import requests # このライブラリが必要です (ターミナルで pip install requests を実行)

class AWSSigningV4:
    def __init__(self, access_key, secret_key, host, region, service, payload):
        self.access_key = access_key
        self.secret_key = secret_key
        self.host = host
        self.region = region
        self.service = service
        self.payload = json.dumps(payload)
        self.http_method_name = 'POST'
        self.path = '/paapi5/searchitems'
        self.content_type = 'application/json; charset=utf-8'
        self.content_encoding = 'amz-1.0'
        self.x_amz_target = 'com.amazon.paapi5.v1.ProductAdvertisingAPIv1.SearchItems'

    def get_headers(self):
        t = datetime.datetime.utcnow()
        amz_date = t.strftime('%Y%m%dT%H%M%SZ')
        date_stamp = t.strftime('%Y%m%d')

        # Step 1: Create a canonical request
        canonical_uri = self.path
        canonical_querystring = ''
        canonical_headers = (
            'content-encoding:' + self.content_encoding + '\n' +
            'content-type:' + self.content_type + '\n' +
            'host:' + self.host + '\n' +
            'x-amz-date:' + amz_date + '\n' +
            'x-amz-target:' + self.x_amz_target + '\n'
        )
        signed_headers = 'content-encoding;content-type;host;x-amz-date;x-amz-target'
        payload_hash = hashlib.sha256(self.payload.encode('utf-8')).hexdigest()
        canonical_request = (
            self.http_method_name + '\n' +
            canonical_uri + '\n' +
            canonical_querystring + '\n' +
            canonical_headers + '\n' +
            signed_headers + '\n' +
            payload_hash
        )

        # Step 2: Create the string to sign
        algorithm = 'AWS4-HMAC-SHA256'
        credential_scope = date_stamp + '/' + self.region + '/' + self.service + '/' + 'aws4_request'
        string_to_sign = (
            algorithm + '\n' +
            amz_date + '\n' +
            credential_scope + '\n' +
            hashlib.sha256(canonical_request.encode('utf-8')).hexdigest()
        )

        # Step 3: Calculate the signature
        def sign(key, msg):
            return hmac.new(key, msg.encode('utf-8'), hashlib.sha256).digest()

        signing_key = sign(('AWS4' + self.secret_key).encode('utf-8'), date_stamp)
        signing_key = sign(signing_key, self.region)
        signing_key = sign(signing_key, self.service)
        signing_key = sign(signing_key, 'aws4_request')
        signature = hmac.new(signing_key, string_to_sign.encode('utf-8'), hashlib.sha256).hexdigest()

        # Step 4: Add signing information to the request
        authorization_header = (
            algorithm + ' ' +
            'Credential=' + self.access_key + '/' + credential_scope + ', ' +
            'SignedHeaders=' + signed_headers + ', ' +
            'Signature=' + signature
        )
        
        headers = {
            'Accept-Encoding': 'identity',
            'Content-Type': self.content_type,
            'Content-Encoding': self.content_encoding,
            'Host': self.host,
            'X-Amz-Date': amz_date,
            'X-Amz-Target': self.x_amz_target,
            'Authorization': authorization_header
        }
        return headers

    def request(self):
        endpoint = 'https://' + self.host + self.path
        headers = self.get_headers()
        response = requests.post(endpoint, data=self.payload, headers=headers)
        return response.text