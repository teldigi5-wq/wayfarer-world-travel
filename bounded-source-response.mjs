/* Defense-in-depth bounded public/provider reads.
   Prevent untrusted chunked/no-Content-Length bodies from being accumulated
   without a byte cap. Handles plain mock responses in existing unit tests. */
export async function readBoundedText(response,maxBytes){
  if(!Number.isSafeInteger(maxBytes)||maxBytes<1||maxBytes>3_000_000)
    throw Error('Invalid maximum response size');
  const advertised=response.headers?.get?.('content-length');
  if(advertised!=null&&advertised!==''&&
    /^\d+$/.test(String(advertised))&&Number(advertised)>maxBytes)
    throw Error('Upstream response exceeds size limit');
  const reader=response.body?.getReader?.();
  if(!reader){
    // Compatibility with lightweight response mocks; actual HTTP responses
    // use the streaming path and cannot accumulate oversized bodies.
    const text=await response.text();
    if(Buffer.byteLength(text,'utf8')>maxBytes)
      throw Error('Upstream response exceeds size limit');
    return text;
  }
  let bytes=0,output='',completed=false;
  const decoder=new TextDecoder('utf-8',{fatal:true});
  try{
    while(true){
      const chunk=await reader.read();
      if(chunk.done){completed=true;break;}
      if(!(chunk.value instanceof Uint8Array))throw Error('Invalid upstream data');
      bytes+=chunk.value.byteLength;
      if(bytes>maxBytes)throw Error('Upstream response exceeds size limit');
      output+=decoder.decode(chunk.value,{stream:true});
    }
    output+=decoder.decode();
    return output;
  }finally{
    if(!completed){try{await reader.cancel();}catch{/* reading already failed */}}
    try{reader.releaseLock();}catch{/* stream already released */}
  }
}
