// Pure Deno SMTP client for Gmail - no external deps
// Usage: await smtpConnectTLS({hostname: 'smtp.gmail.com', port: 465, username, password})

async function smtpConnectTLS(options: {hostname: string, port: number, username: string, password: string}) {
  const { hostname, port, username, password } = options;
  
  // Connect TLS
  const conn = await Deno.connectTls({ hostname, port });
  
  // Read banner
  const readLine = async () => {
    let data = '';
    let buf = new Uint8Array(1024);
    while (true) {
      const n = await conn.read(buf);
      if (n === null) break;
      data += new TextDecoder().decode(buf.slice(0, n));
      if (data.includes('\r\n')) break;
    }
    return data.trim();
  };
  
  const sendCmd = async (cmd: string) => {
    await conn.write(new TextEncoder().encode(cmd + '\r\n'));
    return await readLine();
  };
  
  const banner = await readLine();
  console.log('SMTP Banner:', banner);
  
  // EHLO
  let resp = await sendCmd(`EHLO ${Deno.hostname()}`);
  if (!resp.startsWith('250')) throw new Error(`EHLO failed: ${resp}`);
  
  // AUTH LOGIN
  resp = await sendCmd('AUTH LOGIN');
  if (!resp.startsWith('334')) throw new Error(`AUTH LOGIN failed: ${resp}`);
  
  // Username (base64)
  resp = await sendCmd(btoa(username));
  if (!resp.startsWith('334')) throw new Error(`AUTH username failed: ${resp}`);
  
  // Password (base64)
  resp = await sendCmd(btoa(password));
  if (!resp.startsWith('235')) throw new Error(`AUTH password failed: ${resp}`);
  
  return {
    conn,
    send: async ({ to, subject, content }: { to: string, subject: string, content: string }) => {
      resp = await sendCmd(`MAIL FROM:<${username}>`);
      if (!resp.startsWith('250')) throw new Error(`MAIL FROM failed: ${resp}`);
      
      resp = await sendCmd(`RCPT TO:<${to}>`);
      if (!resp.startsWith('250')) throw new Error(`RCPT TO failed: ${resp}`);
      
      resp = await sendCmd('DATA');
      if (!resp.startsWith('354')) throw new Error(`DATA failed: ${resp}`);
      
      const msg = `From: ${username}\r\nTo: ${to}\r\nSubject: ${subject}\r\n\r\n${content}\r\n.\r\n`;
      await conn.write(new TextEncoder().encode(msg));
      
      resp = await readLine();
      if (!resp.startsWith('250')) throw new Error(`Send failed: ${resp}`);
    },
    close: async () => {
      await sendCmd('QUIT');
      conn.close();
    }
  };
}
