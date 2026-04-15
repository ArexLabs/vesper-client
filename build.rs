fn main() -> Result<(), Box<dyn std::error::Error>> {
    let proto_file = "crates/vesper-core/src/protocol/vesper.proto";
    
    if !std::path::Path::new(proto_file).exists() {
        return Ok(());
    }

    let mut config = tonic_build::Config::new();
    
    config.build(
        ["--proto_path", "crates/vesper-core/src/protocol", proto_file],
        "crates/vesper-proto/src",
    )?;

    Ok(())
}