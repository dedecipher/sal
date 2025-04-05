import { HostConfig, ClientConfig, Modality, SalRequest, SalResponse, SalMethod } from '../src/types';
import { SalClient, SalHost } from '../src/sal';
import { Keypair } from '@solana/web3.js';

const hostKeypair = Keypair.generate();
const clientKeypair = Keypair.generate();

it('scenario test', () => {
  const host = new SalHost({
    cluster: 'testnet',
    phoneNumber: '123-456-7890',
    host: 'localhost',
    keyPair: hostKeypair,
    modality: Modality.VOICE
  });

  const client = new SalClient({
    cluster: 'testnet',
    keyPair: clientKeypair,
    modality: Modality.VOICE
  });

  client.connect('localhost', '123-456-7890');

  // const request: SalRequest = {
  //   method: SalMethod.MSG,
  //   sig: 'mockSignature',
  //   msg: {
  //     headers: {
  //       host: hostConfig.host,
  //       phone: hostConfig.phoneNumber,
  //       nonce: '12345',
  //       publicKey: clientKeypair.publicKey.toBase58()
  //     },
  //     body: 'Hello, Host!'
  //   }
  // };

  // // Simulate host response
  // const response: SalResponse = {
  //   status: 'ok',
  //   code: 200,
  //   sig: 'mockSignature',
  //   msg: {
  //     headers: request.msg.headers,
  //     body: 'Hello, Client!'
  //   }
  // };

  // // Assertions
  // expect(response.status).toBe('ok');
  // expect(response.code).toBe(200);
  // expect(response.msg.body).toBe('Hello, Client!');
});
