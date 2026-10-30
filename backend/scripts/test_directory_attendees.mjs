// Offline service checks; no Microsoft account, token or network request is used.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source=fs.readFileSync('src/lib/directoryAttendeeService.ts','utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const calls=[];
class InteractionRequiredAuthError extends Error {}
const msal={getActiveAccount:()=>({id:'account'}),getAllAccounts:()=>[],
  acquireTokenSilent:async args=>{calls.push(args);return {accessToken:'offline-token'};},
  acquireTokenPopup:async args=>{calls.push({...args,popup:true});}};
let status=200,requested;
const module={exports:{}};
vm.runInNewContext(compiled,{exports:module.exports,module,URLSearchParams,DOMException,
  require:name=>name==='@azure/msal-browser'?{InteractionRequiredAuthError}:name==='./apiClient'?{apiClient:{get:async(path,config)=>{
    assert.equal(path,'/meeting-plans/attendees');assert.equal(config.params.search,'Jane');
    return {data:{items:[{id:'local',name:'Jane Local',email:'JANE@example.com'}]}};
  }}}:{msalInstance:msal},
  fetch:async(url,options)=>{requested={url,options};return {status,ok:status===200,json:async()=>({value:[{id:'1',displayName:'Jane Doe',mail:'Jane@example.com'}]})};}});
const service=module.exports;
const params=new URL('https://offline'+service.directorySearchPath("O'Connor")).searchParams;
assert.equal(params.get('$top'),'8');
assert.ok(params.get('$filter').includes("startswith(displayName,'O''Connor')"));
const people=service.directoryAttendees({value:[
  {id:'1',displayName:'Jane',mail:' JANE@example.com '},
  {id:'2',mail:'jane@example.com'},
  {id:'3',userPrincipalName:'guest_other.com#EXT#@tenant.example.com'},
  {id:'4',userPrincipalName:'someone@example.com'},
  {id:'5',mail:'bad\n@example.com'},
]});
assert.equal(people.length,2);assert.equal(people[0].email,'jane@example.com');assert.equal(people[1].email,'someone@example.com');
await service.searchDirectoryAttendees('a');assert.equal(calls.length,0);
const found=await service.searchDirectoryAttendees('Ja');assert.equal(found[0].name,'Jane Doe');
assert.equal(calls[0].scopes[0],'User.ReadBasic.All');
assert.equal(requested.options.headers.Authorization,'Bearer offline-token');
assert.ok(requested.url.startsWith('https://graph.microsoft.com/v1.0/users?'));
status=403;await assert.rejects(service.searchDirectoryAttendees('Ja'),/Connect your Microsoft directory/);
status=429;await assert.rejects(service.searchDirectoryAttendees('Ja'),/busy/);
msal.acquireTokenSilent=async()=>{throw new InteractionRequiredAuthError();};
await assert.rejects(service.searchDirectoryAttendees('Ja'),/Connect your Microsoft directory/);
await service.connectAttendeeDirectory();assert.ok(calls.at(-1).popup);
const local=await service.searchPlatformAttendees(' Jane ');
assert.equal(local[0].email,'jane@example.com');assert.equal(local[0].source,'AIMPLIFY');
console.log('PASS: OData escaping, bounded search, email normalization/deduplication, guest fallback, scoped Graph token, consent, throttling and explicit connection.');
