'use strict';
// Shared Markdown rule: preserve source maps and keep raw HTML disabled.
module.exports=md=>md.core.ruler.after('inline','important_blocks',state=>{
const tokens=state.tokens;
// GitHub-style important blocks retain prominence in offline and editable readers.
for(let i=0;i<tokens.length-3;i++){
 if(tokens[i].type!=='blockquote_open'||tokens[i+1].type!=='paragraph_open'||tokens[i+2].type!=='inline')continue;
 const inline=tokens[i+2],match=inline.content.match(/^\[!IMPORTANT\](?:\n|$)/);
 if(!match)continue;
 tokens[i].attrJoin('class','callout-important');tokens[i].attrSet('role','note');
 const remainder=inline.content.slice(match[0].length);
 if(remainder){inline.content=remainder;inline.children=md.parseInline(remainder,{})[0].children;}
 else tokens.splice(i+1,3);
}
});
