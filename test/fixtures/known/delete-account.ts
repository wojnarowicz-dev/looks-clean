// KNOWN ANSWER 3, RECONSTRUCTED — dream_analyzer,
// supabase/functions/delete-account/index.ts.
//
// This is NOT a live check and the suite says so. The defect never reached a
// commit of its own: it was found and fixed inside the commit that introduced
// the file, so there is no revision to check out. What survives is the comment
// the fix left behind, which names it exactly:
//
//     "Blad odczytu MUSI przerwac operacje. Wczesniej ladowal w
//      `storagePaths = []`, czyli awaria byla nieodrozninalna od 'ten
//      uzytkownik nie ma grafik' — i krok 2 po cichu nie kasowal niczego,
//      zostawiajac pliki w buckecie po skasowanym koncie."
//
// The shape below is that quotation put back into code. The three neighbouring
// error branches are copied from the file as it stands: each of them ends the
// request with a 500. The select branch is the one that did not.
//
// The consequence is the part worth keeping in mind while reading the rule
// output: nothing here throws, nothing logs an error, and the account deletion
// reports success. The files simply stay in the bucket after the account they
// belonged to is gone — which is the one thing the operation promised to undo.

declare const supabase: any;
declare function jsonResponse(body: unknown, status: number): Response;
declare function extractDreamImagePath(url: string): string | null;
const BUCKET = 'dream-images';

export async function deleteAccount(userId: string): Promise<Response> {
  const { data: codeRow, error: codeError } = await supabase
    .from('deletion_codes')
    .select('code_hash')
    .eq('user_id', userId);

  if (codeError) {
    console.error('DELETE FAILED reading code', JSON.stringify(codeError));
    return jsonResponse({ error: 'DELETE_FAILED' }, 500);
  }
  if (!codeRow) return jsonResponse({ error: 'NO_CODE' }, 400);

  // THE DEFECT. A failed read leaves storagePaths empty, which is exactly what
  // a user with no images leaves it as. Step 2 below then deletes nothing, and
  // says nothing, and the request goes on to report success.
  const { data: dreamRows, error: dreamsSelectError } = await supabase
    .from('dreams')
    .select('image_url')
    .eq('user_id', userId);

  let storagePaths: string[] = [];
  if (dreamsSelectError) {
    storagePaths = [];
  } else {
    storagePaths = (dreamRows ?? [])
      .map((row: any) => row.image_url as string | null)
      .filter((url: unknown): url is string => typeof url === 'string' && url.trim() !== '')
      .map(extractDreamImagePath)
      .filter((p: unknown): p is string => typeof p === 'string' && p.trim() !== '');
  }

  if (storagePaths.length > 0) {
    const { error: storageError } = await supabase.storage.from(BUCKET).remove(storagePaths);
    if (storageError) {
      console.error('DELETE FAILED storage remove', JSON.stringify(storageError));
      return jsonResponse({ error: 'DELETE_FAILED' }, 500);
    }
  }

  const { error: rowsError } = await supabase.from('dreams').delete().eq('user_id', userId);
  if (rowsError) {
    console.error('DELETE FAILED removing rows', JSON.stringify(rowsError));
    return jsonResponse({ error: 'DELETE_FAILED' }, 500);
  }

  const { error: userError } = await supabase.rpc('delete_user', { uid: userId });
  if (userError) {
    console.error('DELETE FAILED removing user', JSON.stringify(userError));
    return jsonResponse({ error: 'DELETE_FAILED' }, 500);
  }

  return jsonResponse({ ok: true }, 200);
}
