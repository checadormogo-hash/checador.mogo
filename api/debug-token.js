export default function handler(req, res) {
  res.status(200).json({
    ok: true,
    hasToken: !!process.env.BLOB_READ_WRITE_TOKEN
  });
}