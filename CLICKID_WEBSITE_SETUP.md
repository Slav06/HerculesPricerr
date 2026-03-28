# Capture Click ID / Ref ID on Your Website

If you use links like `https://www.herculesmovingsolutionsservices.com/?clickid=232323232`, the **clickid** must be captured when the visitor lands and sent with the form so it appears in GoHighLevel (and in your Pricer dashboard).

## 1. Capture clickid on page load

Add this script to your **quote/landing page** (before the form). It reads `clickid` from the URL and keeps it for the form:

```html
<script>
(function() {
  var params = new URLSearchParams(window.location.search);
  var clickid = params.get('clickid') || params.get('ref') || params.get('ref_id') || '';
  if (clickid) {
    sessionStorage.setItem('clickid', clickid);
    // Optional: also keep in a hidden field if form is on same page
    document.addEventListener('DOMContentLoaded', function() {
      var input = document.querySelector('input[name="clickid"], input[name="click_id"], input[id="clickid"]');
      if (input) input.value = clickid;
    });
  }
})();
</script>
```

## 2. Add a hidden field to your form

In your **Get Instant Quote** (or equivalent) form, add a hidden input so the value is submitted:

```html
<input type="hidden" name="clickid" id="clickid" value="">
```

Then on page load (after the form exists), set it from the URL or sessionStorage:

```html
<script>
document.addEventListener('DOMContentLoaded', function() {
  var params = new URLSearchParams(window.location.search);
  var clickid = params.get('clickid') || sessionStorage.getItem('clickid') || '';
  var el = document.getElementById('clickid');
  if (el) el.value = clickid;
});
</script>
```

## 3. Map the field in GoHighLevel

- In **GoHighLevel** → Settings → Custom Fields (or the form’s submission mapping), create a custom field, e.g. **Click ID** or **clickid**.
- Map your form’s **clickid** (or **ref_id**) field to this GHL custom field so it’s saved on the contact.

Once the contact has this custom field, the GHL webhook and Pricer “Pull All Contacts” will store it in `job_submissions` as **Ref** / **Reference** and in **click_id** / **ref_id** columns.

## 4. If your form is in a funnel/embed

- **Funnel/embed:** Use the funnel’s “hidden fields” or “prefill” to pass a value. Set that value from the URL with a script on the page that loads the funnel (e.g. read `?clickid=232323232` and set the hidden field to `232323232`).
- **GoHighLevel form:** Add the custom field “Click ID” to the form and use a prefill or script to set it from the URL when the page loads.

## Summary

1. Read `?clickid=...` from the URL when the visitor lands.
2. Put it in a hidden form field and/or sessionStorage.
3. Submit that field with the form so it reaches GHL as a custom field.
4. Run `ADD_CLICK_ID_REF_COLUMN.sql` in Supabase so Pricer can store and show it.

After that, new submissions from links like `?clickid=232323232` will show the ref id in GoHighLevel and in your lead profile (Ref / Reference) in Pricer.
