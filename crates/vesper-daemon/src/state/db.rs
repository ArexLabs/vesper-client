use sled::Db;

pub struct StateDb {
    db: Db,
}

impl StateDb {
    pub fn new(path: &std::path::Path) -> std::io::Result<Self> {
        let db = sled::open(path)?;
        Ok(Self { db })
    }

    pub fn get(&self, key: &[u8]) -> Option<std::borrow::Cow<[u8]>> {
        self.db.get(key).ok().flatten()
    }

    pub fn set(&self, key: &[u8], value: &[u8]) -> Option<std::io::Error> {
        self.db.insert(key, value).ok()?;
        None
    }

    pub fn remove(&self, key: &[u8]) -> Option<std::io::Error> {
        self.db.remove(key).ok()?;
        None
    }

    pub fn flush(&self) -> std::io::Result<()> {
        self.db.flush()?;
        Ok(())
    }
}