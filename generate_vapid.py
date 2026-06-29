from cryptography.hazmat.primitives.asymmetric import ec
from base64 import urlsafe_b64encode

private_key = ec.generate_private_key(ec.SECP256R1())
public_key = private_key.public_key()

priv_bytes = private_key.private_numbers().private_value.to_bytes(32, 'big')
pub_numbers = public_key.public_numbers()
x = pub_numbers.x.to_bytes(32, 'big')
y = pub_numbers.y.to_bytes(32, 'big')
public_key_b64 = urlsafe_b64encode(b"\x04" + x + y).rstrip(b"=").decode('ascii')
private_key_b64 = urlsafe_b64encode(priv_bytes).rstrip(b"=").decode('ascii')
print('Public Key:')
print(public_key_b64)
print('Private Key:')
print(private_key_b64)
