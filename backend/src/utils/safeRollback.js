async function safeRollback(connection) {
  try {
    await connection.rollback();
  } catch (error) {
    // Preserve the original query/connection error when a fatal MySQL error
    // has already closed the transaction's connection.
    console.error('No se pudo revertir la transacción MySQL:', error.message);
  }
}

module.exports = safeRollback;
